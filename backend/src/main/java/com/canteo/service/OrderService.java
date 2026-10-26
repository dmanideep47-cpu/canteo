package com.canteo.service;

import com.canteo.dto.CreateOrderRequest;
import com.canteo.dto.OrderDto;
import com.canteo.dto.OrderItemRequest;
import com.canteo.exception.InvalidStatusTransitionException;
import com.canteo.exception.QueueFullException;
import com.canteo.exception.ResourceNotFoundException;
import com.canteo.model.*;
import com.canteo.repository.MenuItemRepository;
import com.canteo.repository.OrderRepository;
import com.canteo.repository.UserRepository;
import org.springframework.lang.Nullable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final MenuItemRepository menuItemRepository;
    private final UserRepository userRepository;
    private final QueueService queueService;
    private final TransactionTemplate transactionTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    private static final Object QUEUE_LOCK = new Object();

    public OrderService(
            OrderRepository orderRepository,
            MenuItemRepository menuItemRepository,
            UserRepository userRepository,
            QueueService queueService,
            PlatformTransactionManager transactionManager,
            @Nullable SimpMessagingTemplate messagingTemplate
    ) {
        this.orderRepository = orderRepository;
        this.menuItemRepository = menuItemRepository;
        this.userRepository = userRepository;
        this.queueService = queueService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.messagingTemplate = messagingTemplate;
    }

    public OrderDto createOrder(CreateOrderRequest request) {
        return createOrder(request, null);
    }

    public OrderDto createOrder(CreateOrderRequest request, String userEmail) {
        synchronized (QUEUE_LOCK) {
            OrderDto dto = transactionTemplate.execute(txStatus -> {
                long occupiedSlots = orderRepository.countByStatusIn(QueueService.OCCUPYING_STATUSES);
                if (occupiedSlots >= QueueService.QUEUE_CAPACITY) {
                    throw new QueueFullException("Bounded buffer capacity exceeded: 5 orders already occupying memory buffer.");
                }

                BigDecimal totalAmount = BigDecimal.ZERO;
                Order order = Order.builder()
                        .status(OrderStatus.PLACED)
                        .totalAmount(BigDecimal.ZERO)
                        .build();

                // Set unique human-readable orderNumber
                long currentCount = orderRepository.count();
                String orderNumber = "ORD" + (101 + currentCount);
                order.setOrderNumber(orderNumber);

                if (userEmail != null) {
                    userRepository.findByEmail(userEmail).ifPresent(order::setUser);
                }

                for (OrderItemRequest itemReq : request.getItems()) {
                    MenuItem menuItem = menuItemRepository.findById(itemReq.getMenuItemId())
                            .orElseThrow(() -> new ResourceNotFoundException("MenuItem not found with id: " + itemReq.getMenuItemId()));

                    BigDecimal unitPrice = menuItem.getPrice();
                    BigDecimal subtotal = unitPrice.multiply(BigDecimal.valueOf(itemReq.getQuantity()));
                    totalAmount = totalAmount.add(subtotal);

                    OrderItem orderItem = OrderItem.builder()
                            .menuItem(menuItem)
                            .quantity(itemReq.getQuantity())
                            .unitPriceAtPurchase(unitPrice)
                            .subtotal(subtotal)
                            .build();

                    order.addItem(orderItem);
                }

                order.setTotalAmount(totalAmount);
                Order saved = orderRepository.saveAndFlush(order);
                return OrderDto.fromEntity(saved);
            });

            broadcastUpdates(dto);
            return dto;
        }
    }

    @Transactional(readOnly = true)
    public OrderDto getOrderById(Long id) {
        return getOrderById(id, null);
    }

    @Transactional(readOnly = true)
    public OrderDto getOrderById(Long id, String currentUserEmail) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + id));

        if (currentUserEmail != null) {
            Optional<User> currentUserOpt = userRepository.findByEmail(currentUserEmail);
            if (currentUserOpt.isPresent()) {
                User currentUser = currentUserOpt.get();
                if (currentUser.getRole() == Role.STUDENT && order.getUser() != null) {
                    if (!order.getUser().getId().equals(currentUser.getId())) {
                        throw new AccessDeniedException("Access denied: You cannot view another student's order");
                    }
                }
            }
        }

        return OrderDto.fromEntity(order);
    }

    @Transactional(readOnly = true)
    public OrderDto getOrderByNumber(String orderNumber) {
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with order number: " + orderNumber));
        return OrderDto.fromEntity(order);
    }

    @Transactional(readOnly = true)
    public List<OrderDto> getAllOrders() {
        return orderRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(OrderDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderDto> getOrdersForUser(String currentUserEmail) {
        if (currentUserEmail == null) {
            return getAllOrders();
        }
        Optional<User> userOpt = userRepository.findByEmail(currentUserEmail);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (user.getRole() == Role.STUDENT) {
                return orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                        .map(OrderDto::fromEntity)
                        .collect(Collectors.toList());
            }
        }
        return getAllOrders();
    }

    @Transactional
    public OrderDto updateOrderStatus(Long id, OrderStatus newStatus) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + id));

        OrderStatus currentStatus = order.getStatus();
        if (!isValidTransition(currentStatus, newStatus)) {
            throw new InvalidStatusTransitionException(
                    String.format("Cannot transition order %s from %s to %s", order.getOrderNumber(), currentStatus, newStatus)
            );
        }

        order.setStatus(newStatus);
        Order updated = orderRepository.save(order);
        OrderDto dto = OrderDto.fromEntity(updated);
        broadcastUpdates(dto);
        return dto;
    }

    @Transactional
    public OrderDto payOrder(Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + id));
        order.setStatus(OrderStatus.PAID);
        Order updated = orderRepository.save(order);
        OrderDto dto = OrderDto.fromEntity(updated);
        broadcastUpdates(dto);
        return dto;
    }

    private void broadcastUpdates(OrderDto dto) {
        if (messagingTemplate != null) {
            try {
                messagingTemplate.convertAndSend("/topic/queue", queueService.getQueueStatus());
                if (dto != null && dto.getId() != null) {
                    messagingTemplate.convertAndSend("/topic/orders/" + dto.getId(), dto);
                }
            } catch (Exception e) {
                // Ignore WebSocket delivery exception in headless/test environments
            }
        }
    }

    private boolean isValidTransition(OrderStatus from, OrderStatus to) {
        if (from == to) return true;
        return switch (from) {
            case PLACED -> to == OrderStatus.ACCEPTED || to == OrderStatus.PREPARING || to == OrderStatus.CANCELLED;
            case ACCEPTED -> to == OrderStatus.PREPARING || to == OrderStatus.CANCELLED;
            case PREPARING -> to == OrderStatus.READY || to == OrderStatus.CANCELLED;
            case READY -> to == OrderStatus.COMPLETED || to == OrderStatus.PAID;
            case COMPLETED -> to == OrderStatus.PAID;
            case PAID, CANCELLED -> false;
        };
    }
}

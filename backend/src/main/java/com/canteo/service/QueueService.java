package com.canteo.service;

import com.canteo.dto.OrderDto;
import com.canteo.dto.QueueStatusDto;
import com.canteo.model.Order;
import com.canteo.model.OrderStatus;
import com.canteo.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class QueueService {

    public static final int QUEUE_CAPACITY = 5;
    public static final List<OrderStatus> OCCUPYING_STATUSES = Arrays.asList(
            OrderStatus.PLACED,
            OrderStatus.ACCEPTED,
            OrderStatus.PREPARING
    );

    private final OrderRepository orderRepository;

    public QueueService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public QueueStatusDto getQueueStatus() {
        List<Order> activeOrders = orderRepository.findByStatusInOrderByCreatedAtAsc(OCCUPYING_STATUSES);
        int occupied = activeOrders.size();
        int available = Math.max(0, QUEUE_CAPACITY - occupied);

        List<OrderDto> waitingDtos = activeOrders.stream()
                .map(OrderDto::fromEntity)
                .collect(Collectors.toList());

        return QueueStatusDto.builder()
                .capacity(QUEUE_CAPACITY)
                .occupied(occupied)
                .available(available)
                .waitingOrders(waitingDtos)
                .build();
    }

    public int getQueuePosition(Long orderId) {
        List<Order> activeOrders = orderRepository.findByStatusInOrderByCreatedAtAsc(OCCUPYING_STATUSES);
        for (int i = 0; i < activeOrders.size(); i++) {
            if (activeOrders.get(i).getId().equals(orderId)) {
                return i + 1;
            }
        }
        return -1;
    }
}

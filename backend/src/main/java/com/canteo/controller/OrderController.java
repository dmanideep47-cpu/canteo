package com.canteo.controller;

import com.canteo.dto.CreateOrderRequest;
import com.canteo.dto.OrderDto;
import com.canteo.dto.OrderStatusUpdateRequest;
import com.canteo.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public ResponseEntity<OrderDto> createOrder(
            @Valid @RequestBody CreateOrderRequest request,
            Principal principal
    ) {
        String email = principal != null ? principal.getName() : null;
        OrderDto created = orderService.createOrder(request, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderDto> getOrder(
            @PathVariable Long id,
            Principal principal
    ) {
        String email = principal != null ? principal.getName() : null;
        return ResponseEntity.ok(orderService.getOrderById(id, email));
    }

    @GetMapping
    public ResponseEntity<List<OrderDto>> getOrders(Principal principal) {
        String email = principal != null ? principal.getName() : null;
        return ResponseEntity.ok(orderService.getOrdersForUser(email));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<OrderDto> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody OrderStatusUpdateRequest request
    ) {
        return ResponseEntity.ok(orderService.updateOrderStatus(id, request.getStatus()));
    }

    @PostMapping("/{id}/pay")
    public ResponseEntity<OrderDto> payOrder(@PathVariable Long id) {
        return ResponseEntity.ok(orderService.payOrder(id));
    }
}

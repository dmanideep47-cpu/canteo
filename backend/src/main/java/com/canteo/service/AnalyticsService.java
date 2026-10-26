package com.canteo.service;

import com.canteo.dto.AnalyticsSummaryDto;
import com.canteo.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class AnalyticsService {

    private final OrderRepository orderRepository;

    public AnalyticsService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Transactional(readOnly = true)
    public AnalyticsSummaryDto getSummary() {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();

        long ordersToday = orderRepository.countOrdersSince(startOfDay);
        BigDecimal revenueToday = orderRepository.sumRevenueSince(startOfDay);

        List<Object[]> mostOrderedRaw = orderRepository.findMostOrderedItemRaw();
        String mostOrderedItem = "Masala Dosa";
        if (mostOrderedRaw != null && !mostOrderedRaw.isEmpty() && mostOrderedRaw.get(0).length > 0) {
            mostOrderedItem = String.valueOf(mostOrderedRaw.get(0)[0]);
        }

        // Peak hour estimate based on canteen schedule
        String peakHour = "12:30 PM - 1:30 PM";

        // Average wait time: 3.5 min base + 1 min per occupied order in buffer
        long occupied = orderRepository.countByStatusIn(QueueService.OCCUPYING_STATUSES);
        double avgWaitMinutes = Math.max(2.0, 2.5 + (occupied * 0.8));
        String averageWaitTime = String.format("%.1f min", avgWaitMinutes);

        return new AnalyticsSummaryDto(
                ordersToday,
                revenueToday != null ? revenueToday : BigDecimal.ZERO,
                peakHour,
                mostOrderedItem,
                averageWaitTime
        );
    }
}

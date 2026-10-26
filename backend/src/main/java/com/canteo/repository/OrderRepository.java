package com.canteo.repository;

import com.canteo.model.Order;
import com.canteo.model.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    Optional<Order> findByOrderNumber(String orderNumber);

    List<Order> findByStatusInOrderByCreatedAtAsc(Collection<OrderStatus> statuses);

    @Query("SELECT COUNT(o) FROM Order o WHERE o.status IN :statuses")
    long countByStatusIn(@Param("statuses") Collection<OrderStatus> statuses);

    List<Order> findAllByOrderByCreatedAtDesc();

    List<Order> findByUserIdOrderByCreatedAtDesc(Long userId);

    @Query("SELECT COUNT(o) FROM Order o WHERE o.createdAt >= :since")
    long countOrdersSince(@Param("since") java.time.LocalDateTime since);

    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o WHERE o.createdAt >= :since")
    java.math.BigDecimal sumRevenueSince(@Param("since") java.time.LocalDateTime since);

    @Query("SELECT oi.menuItem.name, SUM(oi.quantity) FROM OrderItem oi GROUP BY oi.menuItem.name ORDER BY SUM(oi.quantity) DESC")
    List<Object[]> findMostOrderedItemRaw();
}

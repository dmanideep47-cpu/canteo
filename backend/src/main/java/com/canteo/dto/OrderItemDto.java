package com.canteo.dto;

import com.canteo.model.OrderItem;
import java.math.BigDecimal;

public class OrderItemDto {
    private Long id;
    private Long menuItemId;
    private String menuItemName;
    private Integer quantity;
    private BigDecimal unitPriceAtPurchase;
    private BigDecimal subtotal;

    public OrderItemDto() {}

    public OrderItemDto(Long id, Long menuItemId, String menuItemName, Integer quantity, BigDecimal unitPriceAtPurchase, BigDecimal subtotal) {
        this.id = id;
        this.menuItemId = menuItemId;
        this.menuItemName = menuItemName;
        this.quantity = quantity;
        this.unitPriceAtPurchase = unitPriceAtPurchase;
        this.subtotal = subtotal;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private Long id;
        private Long menuItemId;
        private String menuItemName;
        private Integer quantity;
        private BigDecimal unitPriceAtPurchase;
        private BigDecimal subtotal;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder menuItemId(Long menuItemId) { this.menuItemId = menuItemId; return this; }
        public Builder menuItemName(String menuItemName) { this.menuItemName = menuItemName; return this; }
        public Builder quantity(Integer quantity) { this.quantity = quantity; return this; }
        public Builder unitPriceAtPurchase(BigDecimal unitPriceAtPurchase) { this.unitPriceAtPurchase = unitPriceAtPurchase; return this; }
        public Builder subtotal(BigDecimal subtotal) { this.subtotal = subtotal; return this; }

        public OrderItemDto build() {
            return new OrderItemDto(id, menuItemId, menuItemName, quantity, unitPriceAtPurchase, subtotal);
        }
    }

    public static OrderItemDto fromEntity(OrderItem item) {
        return OrderItemDto.builder()
                .id(item.getId())
                .menuItemId(item.getMenuItem().getId())
                .menuItemName(item.getMenuItem().getName())
                .quantity(item.getQuantity())
                .unitPriceAtPurchase(item.getUnitPriceAtPurchase())
                .subtotal(item.getSubtotal())
                .build();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getMenuItemId() { return menuItemId; }
    public void setMenuItemId(Long menuItemId) { this.menuItemId = menuItemId; }

    public String getMenuItemName() { return menuItemName; }
    public void setMenuItemName(String menuItemName) { this.menuItemName = menuItemName; }

    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }

    public BigDecimal getUnitPriceAtPurchase() { return unitPriceAtPurchase; }
    public void setUnitPriceAtPurchase(BigDecimal unitPriceAtPurchase) { this.unitPriceAtPurchase = unitPriceAtPurchase; }

    public BigDecimal getSubtotal() { return subtotal; }
    public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }
}

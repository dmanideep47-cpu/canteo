package com.canteo.dto;

import java.util.List;

public class QueueStatusDto {
    private Integer capacity;
    private Integer occupied;
    private Integer available;
    private List<OrderDto> waitingOrders;

    public QueueStatusDto() {}

    public QueueStatusDto(Integer capacity, Integer occupied, Integer available, List<OrderDto> waitingOrders) {
        this.capacity = capacity;
        this.occupied = occupied;
        this.available = available;
        this.waitingOrders = waitingOrders;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private Integer capacity;
        private Integer occupied;
        private Integer available;
        private List<OrderDto> waitingOrders;

        public Builder capacity(Integer capacity) { this.capacity = capacity; return this; }
        public Builder occupied(Integer occupied) { this.occupied = occupied; return this; }
        public Builder available(Integer available) { this.available = available; return this; }
        public Builder waitingOrders(List<OrderDto> waitingOrders) { this.waitingOrders = waitingOrders; return this; }

        public QueueStatusDto build() {
            return new QueueStatusDto(capacity, occupied, available, waitingOrders);
        }
    }

    public Integer getCapacity() { return capacity; }
    public void setCapacity(Integer capacity) { this.capacity = capacity; }

    public Integer getOccupied() { return occupied; }
    public void setOccupied(Integer occupied) { this.occupied = occupied; }

    public Integer getAvailable() { return available; }
    public void setAvailable(Integer available) { this.available = available; }

    public List<OrderDto> getWaitingOrders() { return waitingOrders; }
    public void setWaitingOrders(List<OrderDto> waitingOrders) { this.waitingOrders = waitingOrders; }
}

package com.canteo.model;

public enum OrderStatus {
    PLACED,
    ACCEPTED,
    PREPARING,
    READY,
    COMPLETED,
    PAID,
    CANCELLED;

    public boolean isBufferOccupant() {
        return this == PLACED || this == ACCEPTED || this == PREPARING;
    }
}

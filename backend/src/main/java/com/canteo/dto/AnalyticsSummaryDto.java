package com.canteo.dto;

import java.math.BigDecimal;

public class AnalyticsSummaryDto {
    private long ordersToday;
    private BigDecimal revenueToday;
    private String peakHour;
    private String mostOrderedItem;
    private String averageWaitTime;

    public AnalyticsSummaryDto() {}

    public AnalyticsSummaryDto(long ordersToday, BigDecimal revenueToday, String peakHour, String mostOrderedItem, String averageWaitTime) {
        this.ordersToday = ordersToday;
        this.revenueToday = revenueToday;
        this.peakHour = peakHour;
        this.mostOrderedItem = mostOrderedItem;
        this.averageWaitTime = averageWaitTime;
    }

    public long getOrdersToday() { return ordersToday; }
    public void setOrdersToday(long ordersToday) { this.ordersToday = ordersToday; }

    public BigDecimal getRevenueToday() { return revenueToday; }
    public void setRevenueToday(BigDecimal revenueToday) { this.revenueToday = revenueToday; }

    public String getPeakHour() { return peakHour; }
    public void setPeakHour(String peakHour) { this.peakHour = peakHour; }

    public String getMostOrderedItem() { return mostOrderedItem; }
    public void setMostOrderedItem(String mostOrderedItem) { this.mostOrderedItem = mostOrderedItem; }

    public String getAverageWaitTime() { return averageWaitTime; }
    public void setAverageWaitTime(String averageWaitTime) { this.averageWaitTime = averageWaitTime; }
}

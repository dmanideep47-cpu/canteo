package com.canteo;

import com.canteo.dto.AuthResponse;
import com.canteo.dto.CreateOrderRequest;
import com.canteo.dto.OrderItemRequest;
import com.canteo.repository.OrderRepository;
import com.canteo.service.OrderService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class AnalyticsAndPaymentIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private OrderService orderService;

    @Autowired
    private OrderRepository orderRepository;

    @BeforeEach
    void setup() {
        orderRepository.deleteAll();
    }

    private String loginAndGetToken(String email, String password) throws Exception {
        String loginPayload = String.format("""
            {
                "email": "%s",
                "password": "%s"
            }
        """, email, password);

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginPayload))
                .andExpect(status().isOk())
                .andReturn();

        AuthResponse authResponse = objectMapper.readValue(result.getResponse().getContentAsString(), AuthResponse.class);
        return authResponse.getToken();
    }

    @Test
    @DisplayName("Admin can fetch GET /api/analytics/summary with orders and revenue metrics")
    void testAnalyticsSummary() throws Exception {
        // Create an order
        var item = new OrderItemRequest();
        item.setMenuItemId(1L); // Masala Dosa 40
        item.setQuantity(2);
        var req = new CreateOrderRequest();
        req.setItems(List.of(item));
        orderService.createOrder(req, "student@canteo.edu");

        String adminToken = loginAndGetToken("admin@canteo.edu", "password123");

        mockMvc.perform(get("/api/analytics/summary")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ordersToday", is(1)))
                .andExpect(jsonPath("$.revenueToday", is(80.0)))
                .andExpect(jsonPath("$.peakHour", notNullValue()))
                .andExpect(jsonPath("$.averageWaitTime", notNullValue()));
    }

    @Test
    @DisplayName("Student cannot access GET /api/analytics/summary (returns 403 Forbidden)")
    void testStudentCannotAccessAnalytics() throws Exception {
        String studentToken = loginAndGetToken("student@canteo.edu", "password123");

        mockMvc.perform(get("/api/analytics/summary")
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/orders/{id}/pay marks order as PAID (demo payment)")
    void testPayOrderDemo() throws Exception {
        var item = new OrderItemRequest();
        item.setMenuItemId(1L);
        item.setQuantity(1);
        var req = new CreateOrderRequest();
        req.setItems(List.of(item));
        var order = orderService.createOrder(req, "student@canteo.edu");

        String studentToken = loginAndGetToken("student@canteo.edu", "password123");

        mockMvc.perform(post("/api/orders/" + order.getId() + "/pay")
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("PAID")));
    }
}

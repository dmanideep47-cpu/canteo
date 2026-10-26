package com.canteo;

import com.canteo.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.security.test.context.support.WithMockUser(username = "staff@canteo.edu", roles = {"STAFF", "ADMIN"})
public class OrderIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OrderRepository orderRepository;

    @BeforeEach
    void setup() {
        orderRepository.deleteAll();
    }

    @Test
    @DisplayName("Order creation succeeds and calculates total from DB prices (2 Dosa ₹80 + 1 Coffee ₹15 = ₹95)")
    void testOrderCreationCalculatesDbTotal() throws Exception {
        String payload = """
            {
                "items": [
                    { "menuItemId": 1, "quantity": 2 },
                    { "menuItemId": 6, "quantity": 1 }
                ]
            }
        """;

        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.orderNumber", startsWith("ORD")))
                .andExpect(jsonPath("$.status", is("PLACED")))
                .andExpect(jsonPath("$.totalAmount", is(95.00)))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].unitPriceAtPurchase", is(40.00)))
                .andExpect(jsonPath("$.items[0].subtotal", is(80.00)))
                .andExpect(jsonPath("$.items[1].unitPriceAtPurchase", is(15.00)))
                .andExpect(jsonPath("$.items[1].subtotal", is(15.00)));
    }

    @Test
    @DisplayName("6th sequential order returns 409 CONFLICT when buffer is saturated (5/5)")
    void testQueueCapacityLimit() throws Exception {
        String payload = """
            {
                "items": [
                    { "menuItemId": 5, "quantity": 1 }
                ]
            }
        """;

        // Place 5 orders to saturate buffer
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/orders")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isCreated());
        }

        // 6th order must be rejected with 409 Conflict
        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status", is(409)))
                .andExpect(jsonPath("$.error", is("Queue Capacity Exceeded")));
    }

    @Test
    @DisplayName("Concurrent order creation does not exceed capacity (10 threads -> exactly 5 succeed, 5 return 409)")
    void testConcurrentOrderCreationCapacity() throws Exception {
        int threads = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threads);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger conflictCount = new AtomicInteger(0);

        String payload = """
            {
                "items": [
                    { "menuItemId": 5, "quantity": 1 }
                ]
            }
        """;

        for (int i = 0; i < threads; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    int statusCode = mockMvc.perform(post("/api/orders")
                                    .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("staff@canteo.edu").roles("STAFF", "STUDENT"))
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(payload))
                            .andReturn()
                            .getResponse()
                            .getStatus();

                    if (statusCode == 201) {
                        successCount.incrementAndGet();
                    } else if (statusCode == 409) {
                        conflictCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        doneLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertEquals(5, successCount.get(), "Exactly 5 orders should succeed into the 5-slot buffer");
        assertEquals(5, conflictCount.get(), "Remaining 5 concurrent attempts must receive 409 CONFLICT");
    }

    @Test
    @DisplayName("Invalid status transition returns 400 BAD REQUEST")
    void testInvalidStatusTransitionReturns400() throws Exception {
        String payload = """
            {
                "items": [
                    { "menuItemId": 1, "quantity": 1 }
                ]
            }
        """;

        String response = mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        // Extract ID
        String idStr = response.split("\"id\":")[1].split(",")[0].trim();

        // Attempt illegal transition: PLACED -> COMPLETED (cannot skip PREPARING & READY)
        String illegalTransition = """
            { "status": "COMPLETED" }
        """;

        mockMvc.perform(patch("/api/orders/" + idStr + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(illegalTransition))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("Invalid Status Transition")));
    }

    @Test
    @DisplayName("Queue status returns capacity: 5, occupied, available, and waitingOrders")
    void testGetQueueStatus() throws Exception {
        String payload = """
            {
                "items": [
                    { "menuItemId": 4, "quantity": 2 }
                ]
            }
        """;

        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/queue/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.capacity", is(5)))
                .andExpect(jsonPath("$.occupied", is(1)))
                .andExpect(jsonPath("$.available", is(4)))
                .andExpect(jsonPath("$.waitingOrders", hasSize(1)));
    }
}

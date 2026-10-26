package com.canteo;

import com.canteo.dto.AuthResponse;
import com.canteo.dto.CreateOrderRequest;
import com.canteo.dto.OrderItemRequest;
import com.canteo.model.OrderStatus;
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
public class AuthIntegrationTest {

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
    @DisplayName("POST /api/auth/register creates new student and returns JWT token")
    void testRegisterSuccess() throws Exception {
        String registerPayload = """
            {
                "email": "freshman@canteo.edu",
                "password": "password123",
                "name": "Freshman Student",
                "role": "STUDENT"
            }
        """;

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token", notNullValue()))
                .andExpect(jsonPath("$.user.email", is("freshman@canteo.edu")))
                .andExpect(jsonPath("$.user.role", is("STUDENT")));
    }

    @Test
    @DisplayName("Unauthenticated access to protected endpoint returns 401 Unauthorized")
    void testUnauthenticatedAccessRejected() throws Exception {
        mockMvc.perform(get("/api/orders"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status", is(401)));
    }

    @Test
    @DisplayName("Student cannot view another student's order (returns 403 Forbidden)")
    void testStudentCannotAccessAnotherStudentOrder() throws Exception {
        // Create an order owned by student 1
        var item = new OrderItemRequest();
        item.setMenuItemId(1L);
        item.setQuantity(1);
        var req = new CreateOrderRequest();
        req.setItems(List.of(item));

        var order = orderService.createOrder(req, "student@canteo.edu");

        // Login as student 2
        String student2Token = loginAndGetToken("student2@canteo.edu", "password123");

        // Attempt to access student 1's order
        mockMvc.perform(get("/api/orders/" + order.getId())
                        .header("Authorization", "Bearer " + student2Token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status", is(403)));
    }

    @Test
    @DisplayName("Staff can view and transition order status to PREPARING (returns 200 OK)")
    void testStaffCanTransitionOrder() throws Exception {
        var item = new OrderItemRequest();
        item.setMenuItemId(1L);
        item.setQuantity(1);
        var req = new CreateOrderRequest();
        req.setItems(List.of(item));

        var order = orderService.createOrder(req, "student@canteo.edu");

        String staffToken = loginAndGetToken("staff@canteo.edu", "password123");

        String patchPayload = """
            {
                "status": "ACCEPTED"
            }
        """;

        mockMvc.perform(patch("/api/orders/" + order.getId() + "/status")
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(patchPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("ACCEPTED")));
    }

    @Test
    @DisplayName("Student cannot transition order status (returns 403 Forbidden)")
    void testStudentCannotTransitionOrderStatus() throws Exception {
        var item = new OrderItemRequest();
        item.setMenuItemId(1L);
        item.setQuantity(1);
        var req = new CreateOrderRequest();
        req.setItems(List.of(item));

        var order = orderService.createOrder(req, "student@canteo.edu");

        String studentToken = loginAndGetToken("student@canteo.edu", "password123");

        String patchPayload = """
            {
                "status": "ACCEPTED"
            }
        """;

        mockMvc.perform(patch("/api/orders/" + order.getId() + "/status")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(patchPayload))
                .andExpect(status().isForbidden());
    }
}

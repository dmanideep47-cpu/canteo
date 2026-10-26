package com.canteo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class MenuIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Menu GET /api/menu returns seeded canteen items")
    void testGetMenuReturnsSeededItems() throws Exception {
        mockMvc.perform(get("/api/menu").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(6))))
                .andExpect(jsonPath("$[0].name", is("Masala Dosa")))
                .andExpect(jsonPath("$[0].price", is(40.00)))
                .andExpect(jsonPath("$[0].category", is("Breakfast")));
    }

    @Test
    @DisplayName("Menu GET /api/menu/{id} returns single item")
    void testGetMenuItemById() throws Exception {
        mockMvc.perform(get("/api/menu/1").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(1)))
                .andExpect(jsonPath("$.name", is("Masala Dosa")));
    }

    @Test
    @DisplayName("Menu GET /api/menu/categories returns distinct categories")
    void testGetCategories() throws Exception {
        mockMvc.perform(get("/api/menu/categories").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasItem("Breakfast")))
                .andExpect(jsonPath("$", hasItem("Meals")))
                .andExpect(jsonPath("$", hasItem("Snacks")))
                .andExpect(jsonPath("$", hasItem("Beverages")));
    }
}

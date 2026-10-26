package com.canteo.dto;

import com.canteo.model.Role;
import com.canteo.model.User;

public class UserDto {
    private Long id;
    private String email;
    private String name;
    private Role role;

    public UserDto() {}

    public UserDto(Long id, String email, String name, Role role) {
        this.id = id;
        this.email = email;
        this.name = name;
        this.role = role;
    }

    public static UserDto fromEntity(User user) {
        if (user == null) return null;
        return new UserDto(user.getId(), user.getEmail(), user.getName(), user.getRole());
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
}

package com.canteo.config;

import com.canteo.model.Role;
import com.canteo.model.User;
import com.canteo.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        seedUserIfNotExists("student@canteo.edu", "password123", "Priya Sharma (Student)", Role.STUDENT);
        seedUserIfNotExists("student2@canteo.edu", "password123", "Rahul Verma (Student)", Role.STUDENT);
        seedUserIfNotExists("staff@canteo.edu", "password123", "Chef Ramesh (Kitchen Staff)", Role.STAFF);
        seedUserIfNotExists("admin@canteo.edu", "password123", "Dean Murthy (Administrator)", Role.ADMIN);
    }

    private void seedUserIfNotExists(String email, String rawPassword, String name, Role role) {
        if (!userRepository.existsByEmail(email)) {
            User user = new User();
            user.setEmail(email);
            user.setName(name);
            user.setPasswordHash(passwordEncoder.encode(rawPassword));
            user.setRole(role);
            userRepository.save(user);
        }
    }
}

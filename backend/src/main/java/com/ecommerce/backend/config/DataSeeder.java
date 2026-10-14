package com.ecommerce.backend.config;

import com.ecommerce.backend.model.Category;
import com.ecommerce.backend.model.Product;
import com.ecommerce.backend.repository.*;
import com.ecommerce.backend.model.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final CartItemRepository cartItemRepository;
    private final PasswordEncoder passwordEncoder;

    // Mot de passe admin lu depuis la variable d'environnement ADMIN_PASSWORD
    @Value("${app.admin.password}")
    private String adminPassword;

    @Override
    public void run(String... args) throws Exception {
        if (adminPassword == null || adminPassword.length() < 12) {
            throw new IllegalStateException("ADMIN_PASSWORD doit contenir au moins 12 caractères.");
        }

        // Seed Admin User (ou synchronise son mot de passe avec ADMIN_PASSWORD)
        Optional<User> existingAdmin = userRepository.findByEmail("admin@shop.com");
        if (existingAdmin.isEmpty()) {
            User admin = User.builder()
                    .firstname("Admin")
                    .lastname("User")
                    .email("admin@shop.com")
                    .password(passwordEncoder.encode(adminPassword))
                    .role("ADMIN")
                    .build();
            userRepository.save(admin);
            System.out.println(">>> Seeded Admin User: admin@shop.com");
        } else if (!passwordEncoder.matches(adminPassword, existingAdmin.get().getPassword())) {
            User admin = existingAdmin.get();
            admin.setPassword(passwordEncoder.encode(adminPassword));
            userRepository.save(admin);
            System.out.println(">>> Admin password updated from ADMIN_PASSWORD");
        }

        // Categories and products are created and managed strictly via Admin Dashboard
    }
}

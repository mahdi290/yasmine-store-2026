package com.ecommerce.backend.config;

import com.ecommerce.backend.model.Category;
import com.ecommerce.backend.model.Product;
import com.ecommerce.backend.repository.*;
import com.ecommerce.backend.model.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

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

    @Override
    public void run(String... args) throws Exception {
        // Seed Admin User
        if (userRepository.findByEmail("admin@shop.com").isEmpty()) {
            User admin = User.builder()
                    .firstname("Admin")
                    .lastname("User")
                    .email("admin@shop.com")
                    .password(passwordEncoder.encode("adminpassword"))
                    .role("ADMIN")
                    .build();
            userRepository.save(admin);
            System.out.println(">>> Seeded Admin User: admin@shop.com / adminpassword");
        }

        // Translate or Seed French Categories & Products
        if (categoryRepository.count() == 0) {
            System.out.println(">>> Database is empty. Seeding French Women's Fashion Store data...");
            
            Category dresses = Category.builder().name("Robes").build();
            Category tops = Category.builder().name("Hauts & Blouses").build();
            Category knitwear = Category.builder().name("Maille").build();
            Category coats = Category.builder().name("Manteaux & Vestes").build();
            Category accessories = Category.builder().name("Accessoires").build();

            categoryRepository.saveAll(List.of(dresses, tops, knitwear, coats, accessories));

            Product p1 = Product.builder()
                    .name("Robe d'Été Fleurie Maxi")
                    .description("Robe maxi fleurie d'été fluide et légère, idéale pour les réceptions ou la plage. Conçue en coton respirant.")
                    .price(new BigDecimal("89.99"))
                    .category(dresses)
                    .brand("Aura Paris")
                    .stock(25)
                    .imageUrl("https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600")
                    .build();

            Product p2 = Product.builder()
                    .name("Blouse en Soie Ivoire")
                    .description("Élégante blouse 100% soie de mûrier pure en coloris ivoire. Boutonnage classique et poignets soignés.")
                    .price(new BigDecimal("65.50"))
                    .category(tops)
                    .brand("Silket")
                    .stock(40)
                    .imageUrl("https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=600")
                    .build();

            Product p3 = Product.builder()
                    .name("Pull en Maille Épaisse")
                    .description("Chaud pull en maille mohair avec col côtelé et emmanchures basses décontractées.")
                    .price(new BigDecimal("75.00"))
                    .category(knitwear)
                    .brand("Nordic Loom")
                    .stock(15)
                    .imageUrl("https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600")
                    .build();

            Product p4 = Product.builder()
                    .name("Trench Coat Classique")
                    .description("Trench à double boutonnage résistant aux intempéries en mélange de laine couleur camel avec ceinture ajustable.")
                    .price(new BigDecimal("149.99"))
                    .category(coats)
                    .brand("VogueLine")
                    .stock(12)
                    .imageUrl("https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500")
                    .build();

            Product p5 = Product.builder()
                    .name("Jupe Midi en Lin")
                    .description("Jupe midi en lin à taille haute en couleur terre cuite avec fentes latérales et boutons décoratifs.")
                    .price(new BigDecimal("45.00"))
                    .category(dresses)
                    .brand("Sienna Studio")
                    .stock(20)
                    .imageUrl("https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600")
                    .build();

            Product p6 = Product.builder()
                    .name("Sac à Main en Cuir de Lux")
                    .description("Sac bandoulière luxueux en cuir italien avec finition dorée polie et bandoulière réglable.")
                    .price(new BigDecimal("199.99"))
                    .category(accessories)
                    .brand("Vera Pelle")
                    .stock(8)
                    .imageUrl("https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600")
                    .build();

            Product p7 = Product.builder()
                    .name("Robe Plissée Émeraude")
                    .description("Superbe robe de soirée plissée vert émeraude avec col licou délicat et dos nu raffiné.")
                    .price(new BigDecimal("125.00"))
                    .category(dresses)
                    .brand("Elise Evening")
                    .stock(10)
                    .imageUrl("https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=600")
                    .build();

            Product p8 = Product.builder()
                    .name("Lunettes de Soleil Yeux de Chat")
                    .description("Lunettes de soleil rétro en acétate style yeux de chat noires avec verres polarisés protection UV400.")
                    .price(new BigDecimal("55.00"))
                    .category(accessories)
                    .brand("Soleil")
                    .stock(50)
                    .imageUrl("https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600")
                    .build();

            productRepository.saveAll(List.of(p1, p2, p3, p4, p5, p6, p7, p8));
            System.out.println(">>> Database successfully seeded with French inventory!");
        } else {
            // Update English category names to French if existing
            List<Category> allCats = categoryRepository.findAll();
            for (Category c : allCats) {
                if ("Dresses".equalsIgnoreCase(c.getName())) c.setName("Robes");
                else if ("Tops & Blouses".equalsIgnoreCase(c.getName())) c.setName("Hauts & Blouses");
                else if ("Knitwear".equalsIgnoreCase(c.getName())) c.setName("Maille");
                else if ("Coats & Jackets".equalsIgnoreCase(c.getName())) c.setName("Manteaux & Vestes");
                else if ("Accessories".equalsIgnoreCase(c.getName())) c.setName("Accessoires");
            }
            categoryRepository.saveAll(allCats);
        }
    }
}

package com.ecommerce.backend.service;

import com.ecommerce.backend.model.Category;
import com.ecommerce.backend.model.Product;
import com.ecommerce.backend.model.QuantityDiscountRule;
import com.ecommerce.backend.repository.CategoryRepository;
import com.ecommerce.backend.repository.ProductRepository;
import com.ecommerce.backend.repository.QuantityDiscountRuleRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

class PricingServiceTest {

    private final PricingService pricing = new PricingService(
            mock(QuantityDiscountRuleRepository.class), mock(CategoryRepository.class), mock(ProductRepository.class));

    private final Category pulls = Category.builder().id(10L).name("Pulls").build();
    private final Category robes = Category.builder().id(20L).name("Robes").build();

    private Product product(long id, String price, Category cat) {
        return Product.builder().id(id).name("P" + id).price(new BigDecimal(price)).category(cat).build();
    }

    private QuantityDiscountRule rule(long id, int min, String pct, String scope) {
        return QuantityDiscountRule.builder().id(id).minQuantity(min).percent(new BigDecimal(pct)).scope(scope).active(true).build();
    }

    private static void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "attendu " + expected + " mais " + actual);
    }

    @Test
    void deuxCouleursDuMemeProduitDeclenchentLaRemise() {
        Product pull = product(1, "80", pulls);
        // 1 pull blanc + 1 pull rouge = 2 lignes du même produit
        PricingService.Quote q = pricing.quote(List.of(
                new PricingService.Line(pull, 1, null),
                new PricingService.Line(pull, 1, null)), List.of(rule(1, 2, "10", QuantityDiscountRule.SCOPE_ALL_PRODUCTS)));

        assertMoney("160", q.subtotal());
        assertMoney("16", q.discountAmount());
        assertMoney("144", q.total());
        assertMoney("10", q.lines().get(1).discountPercent());
        assertEquals(2, q.discounts().get(0).quantity());
    }

    @Test
    void pasDeRemiseSousLeMinimumNiHorsCategorie() {
        Product pull = product(1, "80", pulls);
        Product robe = product(2, "100", robes);
        PricingService.Quote q = pricing.quote(List.of(
                new PricingService.Line(pull, 1, null),
                new PricingService.Line(robe, 1, null)), List.of(rule(1, 2, "10", QuantityDiscountRule.SCOPE_CATEGORY)));
        assertMoney("0", q.discountAmount());
        assertEquals(null, q.describe());
    }

    @Test
    void prixSoldeEtMeilleureRegleSansCumul() {
        Product pull = product(1, "80", pulls);
        pull.setOnSale(true);
        pull.setDiscountPercent(10);
        QuantityDiscountRule cat = rule(1, 2, "10", QuantityDiscountRule.SCOPE_CATEGORY);
        cat.setCategoryId(10L);
        QuantityDiscountRule cart = rule(2, 3, "15", QuantityDiscountRule.SCOPE_CART);

        PricingService.Quote q = pricing.quote(List.of(new PricingService.Line(pull, 3, null)), List.of(cat, cart));

        assertMoney("72", q.lines().get(0).unitPrice());
        assertMoney("216", q.subtotal());
        assertMoney("32.40", q.discountAmount());
        assertEquals(1, q.discounts().size());
        assertEquals(2L, q.discounts().get(0).ruleId());
    }

    @Test
    void offreDuoDeuxHautsA50DtAuLieuDe60() {
        // 1 haut : 30 DT ; 2 hauts (bleu + bordeaux, même produit) : 50 DT
        Product haut = product(1, "30", pulls);
        QuantityDiscountRule duo = rule(1, 2, "16.67", QuantityDiscountRule.SCOPE_PRODUCT);
        duo.setProductId(1L);

        PricingService.Quote un = pricing.quote(List.of(new PricingService.Line(haut, 1, null)), List.of(duo));
        assertMoney("30", un.total());

        PricingService.Quote deux = pricing.quote(List.of(
                new PricingService.Line(haut, 1, null),
                new PricingService.Line(haut, 1, null)), List.of(duo));
        assertMoney("60", deux.subtotal());
        assertMoney("10", deux.discountAmount());
        assertMoney("50", deux.total());
        assertEquals("Achetez 2, économisez 16.67%", pricing.labelOf(duo));
    }

    @Test
    void prixUnitaireImposeEstConserve() {
        Product pull = product(1, "99", pulls);
        PricingService.Quote q = pricing.quote(List.of(new PricingService.Line(pull, 2, new BigDecimal("80"))), List.of());
        assertMoney("160", q.total());
    }
}

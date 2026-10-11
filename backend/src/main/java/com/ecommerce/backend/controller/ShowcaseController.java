package com.ecommerce.backend.controller;

import com.ecommerce.backend.model.ShowcaseCard;
import com.ecommerce.backend.repository.ShowcaseCardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/showcase")
@RequiredArgsConstructor
public class ShowcaseController {

    private final ShowcaseCardRepository showcaseCardRepository;

    @GetMapping
    public ResponseEntity<List<ShowcaseCard>> getShowcaseCards() {
        List<ShowcaseCard> cards = showcaseCardRepository.findAllByOrderByDisplayOrderAsc();
        if (cards.isEmpty()) {
            cards = initDefaultShowcaseCards();
        }
        return ResponseEntity.ok(cards);
    }

    private List<ShowcaseCard> initDefaultShowcaseCards() {
        ShowcaseCard c1 = ShowcaseCard.builder()
                .cardKey("card1")
                .title("Robes & Ensembles")
                .badge("PIÈCES EMBLÉMATIQUES")
                .description("Des coupes fluides et sophistiquées pour toutes vos occasions.")
                .imageUrl("https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=900&auto=format&fit=crop&q=80")
                .categoryQueryName("Robes")
                .colClass("col-lg-7 col-md-12")
                .displayOrder(1)
                .build();

        ShowcaseCard c2 = ShowcaseCard.builder()
                .cardKey("card2")
                .title("Hauts & Chemisiers")
                .badge("CHIC QUOTIDIEN")
                .description("Blouses légères, chemises modernes et coupes fluides.")
                .imageUrl("https://images.unsplash.com/photo-1551803091-e20673f15770?w=900&auto=format&fit=crop&q=80")
                .categoryQueryName("Hauts & Blouses")
                .colClass("col-lg-5 col-md-6")
                .displayOrder(2)
                .build();

        ShowcaseCard c3 = ShowcaseCard.builder()
                .cardKey("card3")
                .title("Maille & Sweats")
                .badge("DOUCEUR DE SAISON")
                .description("Pulls douillets et cardigans élégants pour les journées fraîches.")
                .imageUrl("https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=900&auto=format&fit=crop&q=80")
                .categoryQueryName("Maille")
                .colClass("col-lg-5 col-md-6")
                .displayOrder(3)
                .build();

        ShowcaseCard c4 = ShowcaseCard.builder()
                .cardKey("card4")
                .title("Accessoires & Maroquinerie")
                .badge("FINITIONS RAFFINÉES")
                .description("Sacs en cuir, solaires et accessoires pour parfaire votre allure.")
                .imageUrl("https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=900&auto=format&fit=crop&q=80")
                .categoryQueryName("Accessoires")
                .colClass("col-lg-7 col-md-12")
                .displayOrder(4)
                .build();

        return showcaseCardRepository.saveAll(List.of(c1, c2, c3, c4));
    }
}

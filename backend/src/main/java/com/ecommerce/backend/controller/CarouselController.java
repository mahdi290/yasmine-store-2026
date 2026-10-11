package com.ecommerce.backend.controller;

import com.ecommerce.backend.model.CarouselSlide;
import com.ecommerce.backend.repository.CarouselSlideRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/carousel")
@RequiredArgsConstructor
public class CarouselController {

    private final CarouselSlideRepository carouselSlideRepository;

    @GetMapping
    public ResponseEntity<List<CarouselSlide>> getActiveSlides() {
        List<CarouselSlide> slides = carouselSlideRepository.findAllByActiveTrueOrderByDisplayOrderAsc();
        if (slides.isEmpty()) {
            slides = initDefaultSlides();
        }
        return ResponseEntity.ok(slides);
    }

    private List<CarouselSlide> initDefaultSlides() {
        CarouselSlide s1 = CarouselSlide.builder()
                .badge("NOUVELLE SAISON")
                .title("SUBLIMEZ VOTRE ÉLÉGANCE")
                .subtitle("Des pièces raffinées et intemporelles pour enrichir votre garde-robe avec distinction et style au quotidien.")
                .btnText("DÉCOUVRIR LA BOUTIQUE")
                .link("/category")
                .imageUrl("https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1600&auto=format&fit=crop&q=80")
                .displayOrder(1)
                .active(true)
                .build();

        CarouselSlide s2 = CarouselSlide.builder()
                .badge("COLLECTION FEMME")
                .title("L'AUDACE DU STYLE TUNISIEN")
                .subtitle("Robes glamour, manteaux chics et ensembles signatures. Livraison rapide sur toute la Tunisie avec paiement à la livraison.")
                .btnText("COMMANDER MAINTENANT")
                .link("/category")
                .imageUrl("https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1600&auto=format&fit=crop&q=80")
                .displayOrder(2)
                .active(true)
                .build();

        CarouselSlide s3 = CarouselSlide.builder()
                .badge("ÉDITION LIMITÉE")
                .title("TENDANCES & COUPS DE CŒUR")
                .subtitle("Profitez de notre sélection exclusive de prêt-à-porter féminin et sublimez chaque instant de votre journée.")
                .btnText("VOIR LES TENDANCES")
                .link("/category")
                .imageUrl("https://images.unsplash.com/photo-1445205170230-053b83016050?w=1600&auto=format&fit=crop&q=80")
                .displayOrder(3)
                .active(true)
                .build();

        return carouselSlideRepository.saveAll(List.of(s1, s2, s3));
    }
}

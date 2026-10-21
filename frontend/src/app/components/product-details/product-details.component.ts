import { Component, OnInit, inject, signal, computed, effect, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductService, Product, ProductVariant } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { ToastService } from '../../services/toast.service';
import {
  DiscountService, DiscountRule, effectivePrice, offerExample, offerProgress, rulesForProduct, formatPercent, formatPrice
} from '../../services/discount.service';

// Un article du lot "Composez votre lot" (ex. 1 haut bleu taille S + 1 haut rouge taille M)
interface BundleSlot {
  variantId: number | null;
  size: string;
}

const SIZES = ['S', 'M', 'L', 'XL'];

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.scss']
})
export class ProductDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private discountService = inject(DiscountService);
  private toast = inject(ToastService);
  wishlistService = inject(WishlistService);
  private platformId = inject(PLATFORM_ID);

  readonly formatPercent = formatPercent;
  readonly formatPrice = formatPrice;

  // States
  product = signal<Product | null>(null);
  loading = signal<boolean>(true);
  quantity = signal<number>(1);
  selectedSize = signal<string>('M');
  selectedVariantId = signal<number | null>(null);
  selectedImage = signal<string | null>(null);
  // Bref retour visuel sur le bouton après un ajout au panier
  justAdded = signal<boolean>(false);
  availableSizes = SIZES;

  variants = computed<ProductVariant[]>(() => this.product()?.variants ?? []);

  // Prix unitaire actuel (soldé le cas échéant)
  unitPrice = computed(() => {
    const prod = this.product();
    return prod ? effectivePrice(prod) : 0;
  });

  // Offres "Achetez 2, économisez 10%" applicables à ce produit
  quantityOffers = computed(() => {
    const prod = this.product();
    return prod ? rulesForProduct(prod, this.discountService.activeRules()) : [];
  });

  // Offre mise en avant (la plus accessible)
  mainOffer = computed<DiscountRule | null>(() => this.quantityOffers()[0] ?? null);

  // Où en est le client dans le panier pour l'offre principale
  offerStatus = computed(() => {
    const prod = this.product();
    const offer = this.mainOffer();
    if (!prod || !offer) return null;
    const lines = this.cartService.cartItems().map(i => ({ product: i.product, quantity: i.quantity }));
    const pending = offerProgress(lines, [offer], prod)[0];
    return pending ? { reached: false, current: pending.current, missing: pending.missing } : { reached: true, current: offer.minQuantity, missing: 0 };
  });

  // Lot à composer : seulement pour un produit multicolore et une offre de 2 à 4 articles
  bundleSize = computed(() => {
    const offer = this.mainOffer();
    if (!offer || this.variants().length < 2) return 0;
    return offer.minQuantity >= 2 && offer.minQuantity <= 4 ? offer.minQuantity : 0;
  });
  bundleSlots = signal<BundleSlot[]>([]);

  selectedVariant = computed<ProductVariant | null>(() => {
    const id = this.selectedVariantId();
    return this.variants().find(v => v.id === id) ?? null;
  });

  // Photos de la couleur choisie (ou photo du produit pour les produits sans couleur)
  galleryImages = computed<string[]>(() => {
    const prod = this.product();
    if (!prod) return [];
    const variant = this.selectedVariant();
    if (variant && variant.images?.length) return variant.images;
    return prod.imageUrl ? [prod.imageUrl] : [];
  });

  displayedImage = computed(() => this.selectedImage() || this.galleryImages()[0] || this.product()?.imageUrl || '');

  // Stock par taille de la couleur choisie (ou du produit)
  private currentSizeStocks = computed<{ [key: string]: number }>(() => {
    const variant = this.selectedVariant();
    if (variant) return variant.sizeStocks || {};
    return this.product()?.sizeStocks || {};
  });

  selectedSizeStock = computed(() => {
    if (!this.product()) return 0;
    return this.currentSizeStocks()[this.selectedSize()] ?? 0;
  });

  constructor() {
    // (Ré)initialise le lot quand le produit ou l'offre change : une couleur différente par article
    effect(() => {
      const size = this.bundleSize();
      const variants = this.variants();
      if (size === 0) {
        this.bundleSlots.set([]);
        return;
      }
      const inStock = variants.filter(v => (v.stock ?? 0) > 0);
      const pool = inStock.length > 0 ? inStock : variants;
      this.bundleSlots.set(Array.from({ length: size }, (_, i) => {
        const v = pool[i % pool.length];
        return { variantId: v.id ?? null, size: this.firstSizeInStock(v) ?? 'M' };
      }));
    });
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.route.paramMap.subscribe(params => {
        const idStr = params.get('id');
        if (idStr) {
          this.loadProduct(Number(idStr));
        } else {
          this.route.queryParamMap.subscribe(qParams => {
            const qId = qParams.get('id');
            if (qId) {
              this.loadProduct(Number(qId));
            } else {
              this.loadDefaultProduct();
            }
          });
        }
      });
    } else {
      this.loading.set(false);
    }
  }

  loadProduct(id: number) {
    this.loading.set(true);
    this.productService.getProductById(id).subscribe({
      next: (prod) => {
        this.applyProduct(prod);
        this.loading.set(false);
      },
      error: () => {
        this.loadDefaultProduct();
      }
    });
  }

  loadDefaultProduct() {
    this.loading.set(true);
    this.productService.getProducts().subscribe({
      next: (prods) => {
        if (prods.length > 0) {
          this.applyProduct(prods[0]);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  private applyProduct(prod: Product) {
    this.product.set(prod);
    this.quantity.set(1);
    this.selectedImage.set(null);

    // Couleur choisie depuis la carte produit (?couleur=ID), sinon la première qui a du stock
    const variants = prod.variants ?? [];
    const wanted = Number(this.route.snapshot.queryParamMap.get('couleur'));
    const fromLink = variants.find(v => v.id === wanted);
    const firstInStock = variants.find(v => (v.stock ?? 0) > 0) ?? variants[0];
    this.selectedVariantId.set((fromLink ?? firstInStock)?.id ?? null);
    this.selectFirstSizeInStock();
  }

  private firstSizeInStock(variant?: ProductVariant | null): string | null {
    const stocks = variant ? variant.sizeStocks || {} : this.product()?.sizeStocks || {};
    return SIZES.find(s => (stocks[s] ?? 0) > 0) ?? null;
  }

  private selectFirstSizeInStock() {
    const inStockSize = this.firstSizeInStock(this.selectedVariant());
    if (inStockSize) {
      this.selectedSize.set(inStockSize);
    }
  }

  selectVariant(variant: ProductVariant) {
    this.selectedVariantId.set(variant.id ?? null);
    this.selectedImage.set(null);
    this.quantity.set(1);
    // Garde la taille si elle est disponible dans cette couleur, sinon prend la première en stock
    if ((variant.sizeStocks?.[this.selectedSize()] ?? 0) <= 0) {
      this.selectFirstSizeInStock();
    }
  }

  sizeStock(size: string): number {
    return this.currentSizeStocks()[size] ?? 0;
  }

  variantStock(variant: ProductVariant, size: string): number {
    return variant.sizeStocks?.[size] ?? 0;
  }

  increaseQty() {
    this.quantity.update(q => q + 1);
  }

  decreaseQty() {
    if (this.quantity() > 1) {
      this.quantity.update(q => q - 1);
    }
  }

  changeSize(size: string) {
    this.selectedSize.set(size);
    this.quantity.set(1);
  }

  offerExample(rule: DiscountRule) {
    const prod = this.product();
    return prod ? offerExample(prod, rule) : null;
  }

  toggleFavorite() {
    const prod = this.product();
    if (!prod) return;
    this.wishlistService.toggleFavorite(prod.id);
    this.toast.info(this.wishlistService.isFavorite(prod.id) ? 'Ajouté à vos favoris.' : 'Retiré de vos favoris.');
  }

  /** Quantité déjà dans le panier pour une couleur / taille de ce produit. */
  private inCart(variantId: number | null, size: string): number {
    const prod = this.product();
    if (!prod) return 0;
    return this.cartService.cartItems()
      .filter(i => i.product.id === prod.id && (i.size || 'M') === size && (i.variantId ?? null) === variantId)
      .reduce((sum, i) => sum + i.quantity, 0);
  }

  /** Message après ajout : rappelle ce qui manque pour profiter de l'offre. */
  private afterAddMessage(base: string) {
    const status = this.offerStatus();
    const offer = this.mainOffer();
    let message = base;
    if (offer && status && !status.reached) {
      const unit = status.missing > 1 ? 'articles' : 'article';
      message += ` Ajoutez encore ${status.missing} ${unit} pour profiter de -${formatPercent(offer.percent)} %.`;
    } else if (offer && status?.reached) {
      message += ` Offre -${formatPercent(offer.percent)} % appliquée dans votre panier.`;
    }
    this.toast.success(message, { link: { label: 'Voir le panier', url: '/cart' } });
    this.justAdded.set(true);
    setTimeout(() => this.justAdded.set(false), 1800);
  }

  addToCart() {
    const prod = this.product();
    if (!prod) return;

    const variant = this.selectedVariant();
    if (this.variants().length > 0 && !variant) {
      this.toast.error('Veuillez choisir une couleur.');
      return;
    }

    if (this.selectedSizeStock() <= 0) {
      this.toast.error('Cette taille est en rupture de stock. Choisissez une autre taille ou couleur.');
      return;
    }

    const inCart = this.inCart(variant?.id ?? null, this.selectedSize());
    if (this.quantity() + inCart > this.selectedSizeStock()) {
      const colorTxt = variant ? ` en ${variant.colorName}` : '';
      this.toast.error(`Seulement ${this.selectedSizeStock()} unité(s) en taille ${this.selectedSize()}${colorTxt} (déjà ${inCart} dans votre panier).`);
      return;
    }

    this.cartService.addToCart(prod, this.quantity(), this.selectedSize(), variant).subscribe({
      next: () => {
        const colorTxt = variant ? ` ${variant.colorName}, taille ${this.selectedSize()}` : ` taille ${this.selectedSize()}`;
        this.afterAddMessage(`${this.quantity()} × ${prod.name} (${colorTxt.trim()}) ajouté au panier.`);
      },
      error: () => this.toast.error('Impossible d’ajouter l’article au panier. Veuillez réessayer.')
    });
  }

  // ---------------------------------------------------------------- lot "Composez votre lot"

  bundleVariant(slot: BundleSlot): ProductVariant | null {
    return this.variants().find(v => v.id === slot.variantId) ?? null;
  }

  setSlotVariant(index: number, variant: ProductVariant) {
    this.bundleSlots.update(slots => slots.map((s, i) => {
      if (i !== index) return s;
      const keepSize = (variant.sizeStocks?.[s.size] ?? 0) > 0;
      return { variantId: variant.id ?? null, size: keepSize ? s.size : (this.firstSizeInStock(variant) ?? s.size) };
    }));
  }

  setSlotSize(index: number, size: string) {
    this.bundleSlots.update(slots => slots.map((s, i) => i === index ? { ...s, size } : s));
  }

  // Prix du lot tel qu'il sera facturé
  bundleExample = computed(() => {
    const offer = this.mainOffer();
    return offer && this.bundleSize() > 0 ? this.offerExample(offer) : null;
  });

  /** Premier problème de stock du lot composé, ou null si tout est disponible. */
  bundleProblem(): string | null {
    const needed = new Map<string, number>();
    for (const slot of this.bundleSlots()) {
      const variant = this.bundleVariant(slot);
      if (!variant) return 'Choisissez une couleur pour chaque article.';
      const key = `${variant.id}|${slot.size}`;
      needed.set(key, (needed.get(key) ?? 0) + 1);
      const total = (needed.get(key) ?? 0) + this.inCart(variant.id ?? null, slot.size);
      if (total > this.variantStock(variant, slot.size)) {
        return `${variant.colorName} en taille ${slot.size} : stock insuffisant.`;
      }
    }
    return null;
  }

  addBundle() {
    const prod = this.product();
    if (!prod) return;
    const problem = this.bundleProblem();
    if (problem) {
      this.toast.error(problem);
      return;
    }
    const slots = this.bundleSlots();
    for (const slot of slots) {
      this.cartService.addToCart(prod, 1, slot.size, this.bundleVariant(slot));
    }
    const ex = this.bundleExample();
    const summary = slots.map(s => `${this.bundleVariant(s)?.colorName} ${s.size}`).join(' + ');
    const price = ex ? ` — ${formatPrice(ex.total)} DT au lieu de ${formatPrice(ex.regular)} DT` : '';
    this.toast.success(`Lot ajouté : ${summary}${price}.`, { link: { label: 'Voir le panier', url: '/cart' } });
  }
}

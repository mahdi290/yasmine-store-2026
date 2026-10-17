import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminOrder, AdminOrderUpdate, ORDER_STATUSES, orderStatusLabel } from '../../../services/admin.service';
import { Product, ProductVariant } from '../../../services/product.service';
import { DiscountService, computeQuote, Quote } from '../../../services/discount.service';

// Ligne d'article dans le formulaire de modification
interface EditLine {
  productId: number | null;
  variantId: number | null;
  size: string;
  quantity: number;
}

interface EditForm {
  status: string;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  lines: EditLine[];
}

const SIZES = ['S', 'M', 'L', 'XL'];

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.scss']
})
export class AdminOrdersComponent implements OnInit {
  private adminService = inject(AdminService);
  private discountService = inject(DiscountService);
  private platformId = inject(PLATFORM_ID);

  // States
  orders = signal<AdminOrder[]>([]);
  loading = signal<boolean>(true);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  searchTerm = signal<string>('');
  statusFilter = signal<string>('ALL');

  readonly statuses = ORDER_STATUSES;
  readonly sizes = SIZES;
  readonly statusLabel = orderStatusLabel;

  // Modification / suppression
  products = signal<Product[]>([]);
  modalMode = signal<'edit' | 'delete' | 'none'>('none');
  selectedOrder = signal<AdminOrder | null>(null);
  saving = signal<boolean>(false);
  modalError = signal<string | null>(null);
  editForm: EditForm = this.emptyForm();

  private productsById = computed(() => new Map(this.products().map(p => [p.id, p])));

  // Aperçu du total recalculé (même règle que le serveur, qui fait foi à l'enregistrement)
  preview(): Quote | null {
    const order = this.selectedOrder();
    if (!order) return null;
    const lines = this.editForm.lines
      .map(l => ({ line: l, product: l.productId != null ? this.productsById().get(Number(l.productId)) : undefined }))
      .filter(x => !!x.product)
      .map(x => ({
        product: x.product!,
        quantity: Math.max(0, Number(x.line.quantity) || 0),
        unitPrice: this.originalPrice(order, x.line)
      }));
    return computeQuote(lines, this.discountService.activeRules());
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadOrders();
    } else {
      this.loading.set(false);
    }
  }

  private emptyForm(): EditForm {
    return { status: 'PENDING', customerName: '', phone: '', email: '', address: '', city: '', lines: [] };
  }

  private errorText(err: any, fallback: string): string {
    if (err?.status === 401 || err?.status === 403) return 'Session expirée : veuillez vous reconnecter en tant qu\'administrateur.';
    return err?.error?.error || (typeof err?.error === 'string' ? err.error : fallback);
  }

  loadOrders() {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.adminService.getOrders().subscribe({
      next: (data) => {
        this.orders.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('Impossible de charger les commandes.');
        this.loading.set(false);
      }
    });
  }

  getFilteredOrders(): AdminOrder[] {
    let list = this.orders();

    // Filter by status
    const stat = this.statusFilter();
    if (stat !== 'ALL') {
      list = list.filter(o => o.status === stat);
    }

    // Filter by search term
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return list;

    return list.filter(o =>
      o.id.toString().includes(term) ||
      o.customerName.toLowerCase().includes(term) ||
      (o.customerEmail && o.customerEmail.toLowerCase().includes(term)) ||
      (o.phone && o.phone.toLowerCase().includes(term)) ||
      (o.address && o.address.toLowerCase().includes(term)) ||
      (o.city && o.city.toLowerCase().includes(term))
    );
  }

  private replaceOrder(updated: AdminOrder) {
    this.orders.update(list => list.map(o => o.id === updated.id ? updated : o));
  }

  updateStatus(order: AdminOrder, newStatus: string) {
    this.errorMsg.set(null);
    this.successMsg.set(null);

    this.adminService.updateOrderStatus(order.id, newStatus).subscribe({
      next: (updated) => {
        this.replaceOrder(updated);
        this.successMsg.set(`Le statut de la commande #${order.id} a été mis à jour.`);
      },
      error: (err) => {
        this.errorMsg.set(this.errorText(err, 'Échec de la mise à jour du statut.'));
        // Remet la liste déroulante sur la valeur enregistrée
        this.loadOrders();
      }
    });
  }

  // ---------------------------------------------------------------- modification

  openEdit(order: AdminOrder) {
    this.errorMsg.set(null);
    this.successMsg.set(null);
    this.modalError.set(null);
    this.selectedOrder.set(order);
    this.editForm = {
      status: order.status,
      customerName: order.customerName === 'Client Sans Compte' ? '' : order.customerName,
      phone: order.phone && order.phone !== 'N/A' ? order.phone : '',
      email: order.email || '',
      address: order.address && order.address !== 'N/A' ? order.address : '',
      city: order.city && order.city !== 'N/A' ? order.city : '',
      lines: (order.items || []).map(it => ({
        productId: it.productId,
        variantId: it.variantId ?? null,
        size: it.size || 'M',
        quantity: it.quantity
      }))
    };
    this.modalMode.set('edit');

    // Catalogue nécessaire pour choisir produits, couleurs et tailles
    if (this.products().length === 0) {
      this.adminService.getProducts().subscribe({
        next: (p) => this.products.set(p),
        error: () => this.modalError.set('Impossible de charger les produits.')
      });
    }
  }

  productOf(line: EditLine): Product | undefined {
    return line.productId != null ? this.productsById().get(Number(line.productId)) : undefined;
  }

  variantsOf(line: EditLine): ProductVariant[] {
    return this.productOf(line)?.variants ?? [];
  }

  onProductChange(line: EditLine) {
    const variants = this.variantsOf(line);
    line.variantId = variants.length > 0 ? (variants[0].id ?? null) : null;
  }

  addLine() {
    const first = this.products()[0];
    this.editForm.lines.push({
      productId: first?.id ?? null,
      variantId: first?.variants?.[0]?.id ?? null,
      size: 'M',
      quantity: 1
    });
  }

  removeLine(index: number) {
    this.editForm.lines.splice(index, 1);
  }

  private lineKey(productId: number | null, variantId: number | null | undefined, size: string): string {
    return `${productId}|${variantId ?? null}|${(size || '').toUpperCase()}`;
  }

  /** Prix d'origine si l'article était déjà dans la commande (comme le serveur), sinon prix actuel. */
  private originalPrice(order: AdminOrder, line: EditLine): number | undefined {
    const key = this.lineKey(Number(line.productId), line.variantId != null ? Number(line.variantId) : null, line.size);
    const original = (order.items || []).find(it => this.lineKey(it.productId, it.variantId, it.size) === key);
    return original ? original.price : undefined;
  }

  /** Stock disponible pour la ligne, en comptant ce que la commande réserve déjà. */
  availableFor(line: EditLine): number | null {
    const product = this.productOf(line);
    const order = this.selectedOrder();
    if (!product || !order) return null;
    const variantId = line.variantId != null ? Number(line.variantId) : null;
    const variant = product.variants?.find(v => v.id === variantId);
    if ((product.variants?.length ?? 0) > 0 && !variant) return null;
    const stocks = variant ? variant.sizeStocks : (product.sizeStocks || {});
    let available = stocks?.[line.size] ?? 0;
    if (order.status !== 'CANCELLED') {
      const key = this.lineKey(product.id, variantId, line.size);
      available += (order.items || [])
        .filter(it => this.lineKey(it.productId, it.variantId, it.size) === key)
        .reduce((sum, it) => sum + it.quantity, 0);
    }
    return available;
  }

  saveOrder() {
    const order = this.selectedOrder();
    if (!order) return;
    this.modalError.set(null);

    const f = this.editForm;
    if (!f.customerName.trim() || !f.phone.trim() || !f.address.trim()) {
      this.modalError.set('Le nom, le téléphone et l\'adresse du client sont obligatoires.');
      return;
    }
    if (f.lines.length === 0) {
      this.modalError.set('La commande doit contenir au moins un article.');
      return;
    }
    for (const line of f.lines) {
      const product = this.productOf(line);
      if (!product) {
        this.modalError.set('Chaque article doit avoir un produit.');
        return;
      }
      if ((product.variants?.length ?? 0) > 0 && line.variantId == null) {
        this.modalError.set(`Veuillez choisir une couleur pour ${product.name}.`);
        return;
      }
      const qty = Number(line.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
        this.modalError.set(`Quantité invalide pour ${product.name} (entre 1 et 100).`);
        return;
      }
    }

    const payload: AdminOrderUpdate = {
      status: f.status,
      customerName: f.customerName.trim(),
      phone: f.phone.trim(),
      email: f.email.trim() || null,
      address: f.address.trim(),
      city: f.city.trim() || null,
      items: f.lines.map(l => ({
        productId: Number(l.productId),
        variantId: l.variantId != null ? Number(l.variantId) : null,
        size: l.size,
        quantity: Number(l.quantity)
      }))
    };

    this.saving.set(true);
    this.adminService.updateOrder(order.id, payload).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.replaceOrder(updated);
        this.successMsg.set(`La commande #${order.id} a été modifiée avec succès.`);
        // Le stock des produits a changé : on recharge le catalogue à la prochaine ouverture
        this.products.set([]);
        this.closeModal();
      },
      error: (err) => {
        this.saving.set(false);
        this.modalError.set(this.errorText(err, 'Échec de la modification de la commande.'));
      }
    });
  }

  // ---------------------------------------------------------------- suppression

  openDelete(order: AdminOrder) {
    this.errorMsg.set(null);
    this.successMsg.set(null);
    this.selectedOrder.set(order);
    this.modalMode.set('delete');
  }

  confirmDelete() {
    const order = this.selectedOrder();
    if (!order) return;
    this.saving.set(true);
    this.adminService.deleteOrder(order.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.orders.update(list => list.filter(o => o.id !== order.id));
        this.successMsg.set(`La commande #${order.id} a été supprimée.`);
        this.products.set([]);
        this.closeModal();
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(this.errorText(err, 'Échec de la suppression de la commande.'));
        this.closeModal();
      }
    });
  }

  closeModal() {
    this.modalMode.set('none');
    this.selectedOrder.set(null);
    this.modalError.set(null);
  }
}

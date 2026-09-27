import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from './product.service';

export interface Order {
  id: number;
  totalPrice: number;
  status: string;
  createdAt: string;
  customerName?: string;
  phone?: string;
  address?: string;
  city?: string;
}

export interface OrderItem {
  id: number;
  product: Product;
  quantity: number;
  size: string;
  color: string;
  price: number;
}

export interface OrderHistoryItem {
  order: Order;
  items: OrderItem[];
}

export interface GuestOrderPayload {
  customerName: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  items: Array<{
    productId: number;
    quantity: number;
    size: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8081/api/orders';

  placeOrder(payload: GuestOrderPayload): Observable<OrderHistoryItem> {
    return this.http.post<OrderHistoryItem>(this.apiUrl, payload);
  }

  getOrderHistory(): Observable<OrderHistoryItem[]> {
    return this.http.get<OrderHistoryItem[]>(this.apiUrl);
  }
}

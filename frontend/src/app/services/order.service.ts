import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from './product.service';

export interface Order {
  id: number;
  totalPrice: number;
  status: string;
  createdAt: string;
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

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8081/api/orders';

  placeOrder(): Observable<OrderHistoryItem> {
    return this.http.post<OrderHistoryItem>(this.apiUrl, {});
  }

  getOrderHistory(): Observable<OrderHistoryItem[]> {
    return this.http.get<OrderHistoryItem[]>(this.apiUrl);
  }
}

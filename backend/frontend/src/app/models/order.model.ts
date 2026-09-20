import { Product } from './product.model';

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

export interface OrderHistoryResponse {
  order: Order;
  items: OrderItem[];
}

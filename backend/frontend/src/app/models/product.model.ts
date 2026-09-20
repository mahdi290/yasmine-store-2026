import { Category } from './category.model';

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: Category;
  brand: string;
  stock: number;
  imageUrl: string;
  createdAt: string;
}

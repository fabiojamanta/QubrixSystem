import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth.guard';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ProductsComponent } from './pages/products/products.component';
import { ClientsComponent } from './pages/clients/clients.component';
import { StockComponent } from './pages/stock/stock.component';
import { QuotesComponent } from './pages/quotes/quotes.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { SalesComponent } from './pages/sales/sales.component';
import { CampaignsComponent } from './pages/campaigns/campaigns.component';
import { InfoBoardComponent } from './pages/info-board/info-board.component';
import { UsersComponent } from './pages/users/users.component';

const protectedRoute = [authGuard, roleGuard];

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: '', component: DashboardComponent, canActivate: protectedRoute },
  { path: 'produtos', component: ProductsComponent, canActivate: protectedRoute },
  { path: 'clientes', component: ClientsComponent, canActivate: protectedRoute },
  { path: 'estoque', component: StockComponent, canActivate: protectedRoute },
  { path: 'cotacoes', component: QuotesComponent, canActivate: protectedRoute },
  { path: 'pedidos', component: OrdersComponent, canActivate: protectedRoute },
  { path: 'vendas', component: SalesComponent, canActivate: protectedRoute },
  { path: 'campanhas', component: CampaignsComponent, canActivate: protectedRoute },
  { path: 'informacoes', component: InfoBoardComponent, canActivate: protectedRoute },
  { path: 'usuarios', component: UsersComponent, canActivate: protectedRoute },
  { path: '**', redirectTo: '' },
];

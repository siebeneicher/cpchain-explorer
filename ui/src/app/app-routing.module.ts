import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { BlocksComponent } from './blocks/blocks.component';
import { BlockComponent } from './block/block.component';
import { TransactionsComponent } from './transactions/transactions.component';
import { TransactionComponent } from './transaction/transaction.component';
import { RnodesComponent } from './rnodes/rnodes.component';
import { AddressComponent } from './address/address.component';

const routes: Routes = [
	{ path: '', component: DashboardComponent },
	{ path: 'blocks', component: BlocksComponent },
	{ path: 'block/:number', component: BlockComponent },
	{ path: 'transactions', component: TransactionsComponent },
	{ path: 'tx/:txn', component: TransactionComponent },
	{ path: 'rnodes', component: RnodesComponent },
	{ path: 'address/:addr', component: AddressComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { enableTracing: true } )],
  exports: [RouterModule]
})
export class AppRoutingModule { }

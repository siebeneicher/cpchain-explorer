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
	{ path: '', component: DashboardComponent, data: {animation: 'dashboardPage'} },
	{ path: 'blocks', component: BlocksComponent, data: {animation: 'blocksPage'} },
	{ path: 'block/:number', component: BlockComponent, data: {animation: 'blockPage'} },
	{ path: 'transactions', component: TransactionsComponent, data: {animation: 'transactionsPage'} },
	{ path: 'trx/:txHash', component: TransactionComponent, data: {animation: 'trxPage'} },
	//{ path: 'rnodes', component: RnodesComponent, data: {animation: 'rnodesPage'} },
	{ path: 'address/:addr', component: AddressComponent, data: {animation: 'addressPage'} },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { enableTracing: false, onSameUrlNavigation: 'reload' } )],
  exports: [RouterModule]
})
export class AppRoutingModule { }

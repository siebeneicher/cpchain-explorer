import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { BlocksComponent } from './blocks/blocks.component';
import { BlockComponent } from './block/block.component';
import { TransactionsComponent } from './transactions/transactions.component';
import { TransactionComponent } from './transaction/transaction.component';
import { RnodesComponent } from './rnodes/rnodes.component';
import { RnodesRoiGraphComponent } from './rnodes-roi-graph/rnodes-roi-graph.component';
import { AddressComponent } from './address/address.component';
import { AddressTransactionsComponent } from './address/address-transactions/address-transactions.component';
import { AddressBlocksComponent } from './address/address-blocks/address-blocks.component';
import { SystemStatusComponent } from './system-status/system-status.component';
import { RichListComponent } from './rich-list/rich-list.component';
import { StatsComponent } from './stats/stats.component';

const routes: Routes = [
	{ path: '', /*redirectTo: '', pathMatch: '',*/ component: DashboardComponent, data: {animation: 'dashboardPage', fullMenu: false} },
	{ path: 'blocks', component: BlocksComponent, data: {animation: 'blocksPage'} },
	{ path: 'stats', component: StatsComponent, data: {animation: 'statsPage'} },
	{ path: 'block/:number', component: BlockComponent, data: {animation: 'blockPage'} },
	{ path: 'transactions', component: TransactionsComponent, data: {animation: 'transactionsPage'} },
	{ path: 'trx/:txHash', component: TransactionComponent, data: {animation: 'trxPage'} },
	{ path: 'address/:addr', component: AddressComponent, data: {animation: 'addressPage'}, children: [
		{ path: '', redirectTo: 'transactions', pathMatch: 'full' },
		{ path: 'transactions', component: AddressTransactionsComponent },
		{ path: 'blocks', component: AddressBlocksComponent },
	] },
	{ path: 'system-status', component: SystemStatusComponent, data: {animation: 'systemStatusPage'} },
	{ path: 'rich-list', component: RichListComponent, data: {animation: 'richListPage'} },
	{ path: 'rnodes', component: RnodesComponent, data: {animation: 'rnodesPage'} },
	{ path: 'roi', component: RnodesRoiGraphComponent, data: {animation: 'rnodesRoiGraphPage'} },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { enableTracing: false, onSameUrlNavigation: 'reload', scrollPositionRestoration: 'enabled' } )],
  exports: [RouterModule]
})
export class AppRoutingModule { }

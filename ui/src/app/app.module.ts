import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule } from '@angular/core';
import { FormGroup, FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule, MatCheckboxModule, MatInputModule } from '@angular/material';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { HttpClientModule } from '@angular/common/http';
import { DateAgoPipe } from './pipes/date-ago.pipe';
import { ConvertCpcPipe } from './pipes/convert-cpc.pipe';
import { ConvertTsPipe } from './pipes/convert-ts.pipe';
import { DashboardComponent } from './dashboard/dashboard.component';
import { BlocksComponent } from './blocks/blocks.component';
import { BlocksSquaredComponent } from './blocks-squared/blocks-squared.component';
import { CookieService } from 'ngx-cookie-service';
import { MyRnodeComponent } from './dashboard/my-rnode/my-rnode.component';
import { TrxStreamgraphComponent } from './dashboard/trx-streamgraph/trx-streamgraph.component';
import { BlockComponent } from './block/block.component';
import { TransactionsComponent } from './transactions/transactions.component';
import { TransactionComponent } from './transaction/transaction.component';
import { AddressComponent } from './address/address.component';
import { RnodesComponent } from './rnodes/rnodes.component';
import { ClipboardModule } from 'ngx-clipboard';

import { DeferLoadModule } from '@trademe/ng-defer-load';
import { SystemStatusComponent } from './system-status/system-status.component';
import { TrxGraphComponent } from './trx-graph/trx-graph.component';
import { RichListComponent } from './rich-list/rich-list.component';
import { StatsComponent } from './stats/stats.component';
import { FooterComponent } from './footer/footer.component';
import { AddressTransactionsComponent } from './address/address-transactions/address-transactions.component';
import { AddressBlocksComponent } from './address/address-blocks/address-blocks.component';
import { PriceGraphComponent } from './price-graph/price-graph.component';
import { RnodesRoiGraphComponent } from './rnodes-roi-graph/rnodes-roi-graph.component';

/*import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import localeFrExtra from '@angular/common/locales/extra/fr';
registerLocaleData(localeFr, 'fr-FR', localeFrExtra);*/

@NgModule({
  declarations: [
    AppComponent,
    DateAgoPipe,
    ConvertCpcPipe,
    ConvertTsPipe,
    DashboardComponent,
    BlocksComponent,
    BlocksSquaredComponent,
    MyRnodeComponent,
    TrxStreamgraphComponent,
    BlockComponent,
    TransactionsComponent,
    TransactionComponent,
    AddressComponent,
    RnodesComponent,
    SystemStatusComponent,
    TrxGraphComponent,
    RichListComponent,
    StatsComponent,
    FooterComponent,
    AddressTransactionsComponent,
    AddressBlocksComponent,
    PriceGraphComponent,
    RnodesRoiGraphComponent,
  ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    HttpClientModule,
    DeferLoadModule ,
    ClipboardModule
  ],
  providers: [CookieService],
  bootstrap: [AppComponent]
})
export class AppModule { }

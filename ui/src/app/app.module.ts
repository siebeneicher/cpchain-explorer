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

import { DeferLoadModule } from '@trademe/ng-defer-load';
import { SystemStatusComponent } from './system-status/system-status.component';
import { TrxGraphComponent } from './trx-graph/trx-graph.component';

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
  ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    HttpClientModule,
    DeferLoadModule 
  ],
  providers: [CookieService],
  bootstrap: [AppComponent]
})
export class AppModule { }

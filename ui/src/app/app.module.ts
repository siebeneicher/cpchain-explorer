import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { HttpClientModule } from '@angular/common/http';
import { DateAgoPipe } from './pipes/date-ago.pipe';
import { ConvertTsPipe } from './pipes/convert-ts.pipe';
import { DashboardComponent } from './dashboard/dashboard.component';
import { BlocksComponent } from './blocks/blocks.component';
import { BlocksSquaredComponent } from './blocks-squared/blocks-squared.component';
import { CookieService } from 'ngx-cookie-service';
import { MyRnodeComponent } from './dashboard/my-rnode/my-rnode.component';

@NgModule({
  declarations: [
    AppComponent,
    DateAgoPipe,
    ConvertTsPipe,
    DashboardComponent,
    BlocksComponent,
    BlocksSquaredComponent,
    MyRnodeComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
  ],
  providers: [CookieService],
  bootstrap: [AppComponent]
})
export class AppModule { }

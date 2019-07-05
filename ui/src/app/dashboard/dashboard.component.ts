import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DateAgoPipe } from '../pipes/date-ago.pipe';
import { ConvertTsPipe } from '../pipes/convert-ts.pipe';
import { environment } from '../../environments/environment';
import { CookieService } from 'ngx-cookie-service';
import { KpiService } from '../kpi.service';

@Component({
	selector: 'app-dashboard',
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ DateAgoPipe, ConvertTsPipe ]
})
export class DashboardComponent implements OnInit {
	user_rnode_data:Object;
	dashboard_data:any = null;
	latestRelease:any = {};

	user_rnode_addr:string;

	COOKIE_USER_RNODE:string = "cpc-user-rnode-favorite";		// todo: env.

	constructor (
		private httpClient: HttpClient,
		private ref: ChangeDetectorRef,
		private dateAgo: DateAgoPipe,
		private convertTs: ConvertTsPipe,
		private cookieService: CookieService,
		public kpi: KpiService
	) {
		setInterval(() => {
			this.tick();
		}, 500);
	}

	ngOnInit () {
		this.kpi.require('dashboard');

		this.updateUserRNode(this.cookieService.get(this.COOKIE_USER_RNODE));

		this.loadReleases();
		setInterval(() => {
			this.loadReleases();
		}, 1000 * 60 * 5);
	}
	ngOnDestroy () {
		this.kpi.unrequire('dashboard');
		this.kpi.unrequire('myrnode');
	}

	resetUserRNode () {
		this.updateUserRNode();
	}

	addUserRNode () {
		let ele = document.querySelector('#user_rnode_addr_input') as HTMLInputElement;
		this.updateUserRNode(ele ? ele.value : null);
	}

	updateUserRNode (newAddr = null) {
		// TOOD: check addr

		if (!newAddr) {
			this.user_rnode_addr = null;
			this.cookieService.delete(this.COOKIE_USER_RNODE);
			this.kpi.unrequire('myrnode');
		} else {
			this.user_rnode_addr = newAddr;
			this.cookieService.set(this.COOKIE_USER_RNODE, newAddr);
			this.kpi.require('myrnode', {addr: this.user_rnode_addr});
		}
	}

	tick () {
		this.ref.markForCheck();
	}

	ago (ts) {
		return this.dateAgo.transform(this.convertTs.transform(ts, 13));
	}

	loadReleases () {
		this.httpClient.get(environment.githubCPChainReleasesAPIUrl).subscribe(res => {
			if (!res) return;
			this.latestRelease = res[0];
		});
	}
}

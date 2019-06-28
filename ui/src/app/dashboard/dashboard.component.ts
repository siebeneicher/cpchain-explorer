import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DateAgoPipe } from '../pipes/date-ago.pipe';
import { ConvertTsPipe } from '../pipes/convert-ts.pipe';
import { environment } from '../../environments/environment';
import { CookieService } from 'ngx-cookie-service';

@Component({
	selector: 'app-dashboard',
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ DateAgoPipe, ConvertTsPipe ]
})
export class DashboardComponent implements OnInit {
	units:Array<any> = ['hour','day','month'];
	user_rnode_data:Object;
	dashboard_data:any = null;
	latestRelease:any = {};
	userRNodeAddr:string;

	COOKIE_USER_RNODE:string = "cpc-user-rnode-favorite";		// todo: env.

	constructor (
		private httpClient: HttpClient,
		private ref: ChangeDetectorRef,
		private dateAgo: DateAgoPipe,
		private convertTs: ConvertTsPipe,
		private cookieService: CookieService
	) {
		setInterval(() => {
			this.tick();
		}, 500);
	}

	ngOnInit () {
		this.reload();
		this.loadReleases();
		this.loadUserRNode();

		setInterval(() => {
			this.reload();
			this.loadUserRNode();
		}, 1000);

		setInterval(() => {
			this.loadReleases();
		}, 1000 * 60 * 5);
	}

	tick () {
		this.ref.markForCheck();
	}

	reload () {
		this.loadDashboard();
	}

	loadDashboard () {
	    this.httpClient.get(environment.backendBaseUrl+'/dashboard').subscribe(res => {
	    	this.dashboard_data = res;	    	
	    });
	}

	loadUserRNode () {
		this.userRNodeAddr = this.cookieService.get(this.COOKIE_USER_RNODE);

		if (!this.userRNodeAddr) return;

		// load rnode data from backend
		this.httpClient.get(environment.backendBaseUrl+`/rnode/user/${this.userRNodeAddr}`).subscribe(res => {
			this.user_rnode_data = res;
		});
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

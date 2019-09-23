import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {
	latestRelease:any = {};
	online_cnt:string = '?';

	constructor(
		private httpClient: HttpClient,
	) { }

	ngOnInit() {
		this.loadReleases();
		this.loadOnlineUsers();

		setInterval(() => {
			this.loadReleases();
		}, 1000 * 60 * 5);

		setInterval(() => {
			this.loadOnlineUsers();
		}, 1000 * 30);
	}

	loadReleases () {
		this.httpClient.get(environment.githubCPChainReleasesAPIUrl).subscribe(res => {
			if (!res) return;
			this.latestRelease = res[0];
		});
	}

	loadOnlineUsers () {
		this.httpClient.get('/active-sessions/count').subscribe((res:any) => {
			if (!res) return this.online_cnt = '?';
			this.online_cnt = res.cnt+"";
		});
	}
}

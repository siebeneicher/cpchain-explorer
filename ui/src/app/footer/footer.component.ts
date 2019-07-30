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

	constructor(
		private httpClient: HttpClient,
	) { }

	ngOnInit() {
		this.loadReleases();

		setInterval(() => {
			this.loadReleases();
		}, 1000 * 60 * 5);
	}

	loadReleases () {
		this.httpClient.get(environment.githubCPChainReleasesAPIUrl).subscribe(res => {
			if (!res) return;
			this.latestRelease = res[0];
		});
	}
}

import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-rnodes',
  templateUrl: './rnodes.component.html',
  styleUrls: ['./rnodes.component.scss']
})
export class RnodesComponent implements OnInit {

	rnodes:Array<any> = [];

	constructor(private httpClient: HttpClient,) { }

	ngOnInit() {
		this.load();
	}

	async load () {
		let url = environment.backendBaseUrl + '/rnodes';

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe((res: Array<any>) => {
				this.rnodes = res;
				resolve();
			});
		});
	}

}

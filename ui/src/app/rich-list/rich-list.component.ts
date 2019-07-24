import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-rich-list',
  templateUrl: './rich-list.component.html',
  styleUrls: ['./rich-list.component.scss']
})
export class RichListComponent implements OnInit {

	addresses:Array<any> = [];

	constructor(private httpClient: HttpClient,) { }

	ngOnInit() {
		this.load();
	}

	async load () {
		let url = environment.backendBaseUrl + '/addresses';

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe((res: Array<any>) => {
				this.addresses = res;
				resolve();
			});
		});
	}
}

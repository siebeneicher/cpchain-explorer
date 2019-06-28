import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import * as moment from 'moment';

@Component({
  selector: 'app-blocks-squared',
  templateUrl: './blocks-squared.component.html',
  styleUrls: ['./blocks-squared.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlocksSquaredComponent implements OnInit {
	blocksByHour:Array<any>;

	ts:number = new Date().getTime();
	unit:string = "day";
	mouse_x:number;
	mouse_y:number;
	hovered_block:any;
	hover_tooltip:any;
	loading:boolean = false;

	//@ViewChild('hovertooltip') hovertooltip; 

	constructor(private httpClient: HttpClient, private ref: ChangeDetectorRef) { }

	ngOnInit() {
		this.blocksByHour = [];
		this.loadBlocksSquared();

		setInterval(() => {
			this.loadBlocksSquared();
		}, 10000);

		this.attachTooltipToDocument();
	}

	async loadBlocksSquared () {
		this.loading = true;
		this.httpClient.get(environment.backendBaseUrl+`/blocks-squared?unit=${this.unit}&ts=${this.ts}`).subscribe(res => {
			this.blocksByHour.length = 0;

			let last_h = 0, h = 0;

			// chunk blocks and set state
			for (let key in res) {
				let b = res[key];

				// optimize redraw
				b._trackID = b.timestamp;

				// chunk by hour
				h = moment.utc(b.timestamp).hour();

				if (!this.blocksByHour[h]) this.blocksByHour.push([]);
				this.blocksByHour[h].push(b);
			}

			this.loading = false;
			this.tick();
		});
	}

	tick () {
		this.ref.markForCheck();
	}

	blocksTrackByFn(index, item) {
		return item._trackID;
	}

	sortNull () {}

	attachTooltipToDocument () {
		document.body.appendChild(document.querySelector("#hovertooltip"));
		this.hover_tooltip = document.querySelector("#hovertooltip");
	}

	mousemove (h, $e) {
		this.mouse_x = $e.pageX, this.mouse_y = $e.pageY;

		if ($e.target.className.match(/block/)) {
			let blockNum = $e.target.getAttribute('data-index');
			let block = this.blocksByHour[h.key][blockNum];
			if (block) {
				this.hover_tooltip.style.top = (this.mouse_y + 15) + 'px';
				this.hover_tooltip.style.left = (this.mouse_x + 15) + 'px';
				this.hovered_block = block;
			}
		}
	}

	mouseout () {
		setTimeout(() => {
			this.hovered_block = null;
		}, 2500);
	}

	dateBackward () {
		this.ts = this.ts - 60*60*24*1000;
		this.loadBlocksSquared();
	}

	dateForward () {
		this.ts = this.ts + 60*60*24*1000;
		this.loadBlocksSquared();
	}
}

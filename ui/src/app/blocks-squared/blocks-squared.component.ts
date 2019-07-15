import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
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

	//showComponent:boolean = false;
	initiated:boolean = false;

	ts:number;
	unit:string = "day";
	mouse_x:number;
	mouse_y:number;
	hovered_block:any;
	hover_tooltip:any;
	loading:boolean = false;

	intervalId:any;

	//@ViewChild('hovertooltip') hovertooltip; 

	constructor(private httpClient: HttpClient, private ref: ChangeDetectorRef, private elementRef: ElementRef) { }

	ngOnInit() {
		// the timestamp needs to be the exact start of the day
		let today = moment.utc();
		today.second(0).minute(0).hour(0);
		this.ts = today.unix()*1000;
		this.blocksByHour = [];
		this.attachTooltipToDocument();

		setTimeout(() => {
			this.loadBlocksSquared();
		}, 1500);

		this.intervalId = setInterval(() => {
			this.loadBlocksSquared();
		}, 10000);

/*		setInterval(() => {
			const options = {
			  root: null,
			  rootMargin: '0px',
			  threshold: 1.0,
			  trackVisibility: true,
			  delay: 100
			}

			const observer = new IntersectionObserver((what) => {
				let box = what[0];
				if (box.isVisible) debugger;
			}, options);

			observer.observe(this.elementRef.nativeElement.querySelector('.initial-loading-placeholder'));
		}, 2000);*/
	}

	ngOnDestroy() {
		clearInterval(this.intervalId);
		this.destroyTooltip();
	}

	ngAfterViewInit () {

	}

	visible () {
		if (this.initiated) return;
		//this.loadBlocksSquared();
		setInterval(() => {
			this.loadBlocksSquared();
		}, 10000);
		this.initiated = true;
	}

	async loadBlocksSquared (changed = false) {
		if (changed)		// show loading spinner only when date has been manually changed
			this.loading = true;

		this.httpClient.get(environment.backendBaseUrl+`/blocks-squared/${this.unit}/${this.ts}`).subscribe(res => {
			this.blocksByHour.length = 0;

			let ts_now = moment.utc().unix()*1000;
			let last_h = 0, h = 0;

			// chunk blocks and set state
			for (let key in res) {
				let b = res[key];

				// optimize redraw
				b._trackID = b.timestamp;

				// chunk by hour
				h = moment.utc(b.timestamp).hour();

				// set sync_should on client side, as backend might not update properly in time
				b.sync_should = b.timestamp <= ts_now;

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

	destroyTooltip () {
		const ele = document.querySelector("#hovertooltip");
		ele.parentNode.removeChild(ele);
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
		this.loadBlocksSquared(true);
	}

	dateForward () {
		this.ts = this.ts + 60*60*24*1000;
		this.loadBlocksSquared(true);
	}
}

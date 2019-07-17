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
	blocksFlat:Array<any>;

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
		this.blocksFlat = [];
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
		if (changed) {		// show loading spinner only when date has been manually changed
			this.loading = true;
		}

		const _this = this;

		this.httpClient.get(environment.backendBaseUrl+`/blocks-squared/${this.unit}/${this.ts}`).subscribe((res: any) => {
			const t = performance.now();

			// manual change of date, reset blocks
			if (changed) {
				this.blocksByHour.length = 0;
				this.blocksFlat.length = 0;
			}

			const ts_now = moment.utc().unix()*1000;
			const emptyBlocks = this.blocksByHour.length == 0;

// TODO: make sure timestamp for res[0] and blocksByHour[0][0] is equal, otherwise discard this.blocksByHour

			// chunk processing to smooth cpu and rendering
			_chunk(0, 1000);
			_chunk(1001, 2000);
			_chunk(2001, 3000);
			_chunk(3001, 4000);
			_chunk(4001, 5000);
			_chunk(5001, 6000);
			_chunk(6001, 7000);
			_chunk(7001, res.length-1);

			_this.loading = false;

			async function _chunk (from, to) {
				return new Promise((resolve) => {
					// chunk blocks and set state
					let b, h;
					for (let key = from; key <= to; key++) {
						b = emptyBlocks ? res[key] : _this.blocksFlat[key];

						if (emptyBlocks) {
							// optimize dom redraw
							b._trackID = b.timestamp;

							// chunk by hour
							h = moment.utc(b.timestamp).hour();

							// cluster by hour
							if (!_this.blocksByHour[h]) _this.blocksByHour.push([]);

							_this.blocksByHour[h].push(b);
							_this.blocksFlat.push(b);			// keep reference easily accessable
						}

						// this is time relevant, so it should perform each block reload cycle
						// set sync_should on client side, as backend might not update properly in time
						b.sync_should = b.timestamp <= ts_now;
					}

					//console.log("looped",performance.now()-t);
					_this.tick();
					//console.log("ticked:",performance.now()-t);

					resolve();
				});
			}

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

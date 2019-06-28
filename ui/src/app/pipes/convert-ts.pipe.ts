import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'convertTs'
})
export class ConvertTsPipe implements PipeTransform {

  transform(ts: any, digits?: any): any {
	let l = (ts+"").length;
	if (l == digits) return ts;
	if (l == 10 && digits == 13) return ts*1000;
	if (l == 13 && digits == 10) return Math.floor(ts/1000);
  }

}

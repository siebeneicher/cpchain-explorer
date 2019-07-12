import {trigger, animate, style, group, animateChild, query, stagger, transition} from '@angular/animations';

export const slideInAnimation =
  trigger('routeAnimations', [
    transition('* <=> *', [
      style({ position: 'relative' }),
      query(':enter, :leave', [
        style({
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%'
        })
      ], { optional: true }),
      query(':enter', [
        style({ left: '-100%'})
      ], { optional: true }),
      query(':leave', animateChild(), { optional: true }),
      group([
        query(':leave', [
          animate('300ms ease-out', style({ left: '100%'}))
        ], { optional: true }),
        query(':enter', [
          animate('300ms ease-out', style({ left: '0%'}))
        ], { optional: true })
      ]),
      query(':enter', animateChild(), { optional: true }),
    ])
  ]);

/*export const fadeInOutAnimation =
  trigger('routeAnimations', [
    transition('* <=> *', [    
      query(':enter, :leave', style({ opacity: 1 })),
      group([ 
        query(':enter', [
          style({ opacity:0 }),
          animate('1000ms ease-in-out', style({ opacity:1 }))
        ]),
        query(':leave', [
          style({ opacity:1 }),
          animate('1000ms ease-in-out', style({ opacity:0 }))]),
      ])
    ])
  ]);*/
import {describe,it,expect} from 'vitest';
import {siteOrigin,publicIndexingEnabled} from '../lib/public-indexing';
describe('Demonstration storefront indexing policy',()=>{
  it('disables indexing by default even in production',()=>{
    expect(publicIndexingEnabled({NODE_ENV:'production'})).toBe(false);
    expect(publicIndexingEnabled({NODE_ENV:'development',PUBLIC_INDEXING_ENABLED:'true',
      SITE_ORIGIN:'https://shop.example.test'})).toBe(false);
  });
  it('requires explicit HTTPS canonical site origin',()=>{
    expect(siteOrigin({SITE_ORIGIN:'https://shop.example.test/'})).toBe('https://shop.example.test');
    expect(siteOrigin({SITE_ORIGIN:'http://shop.example.test'})).toBeNull();
    expect(siteOrigin({SITE_ORIGIN:'https://example.com/path'})).toBeNull();
    expect(siteOrigin({SITE_ORIGIN:'https://user:pass@example.com/'})).toBeNull();
    expect(siteOrigin({SITE_ORIGIN:'https://example.com/?token=a'})).toBeNull();
  });
  it('allows opt-in only with HTTPS origin and production flag',()=>{
    expect(publicIndexingEnabled({NODE_ENV:'production',PUBLIC_INDEXING_ENABLED:'true',
      SITE_ORIGIN:'https://shop.example.test'})).toBe(true);
  });
});

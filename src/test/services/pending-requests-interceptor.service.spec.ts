/*
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed, waitForAsync } from '@angular/core/testing';
import { forkJoin, Observable } from 'rxjs';
import {
    PendingRequestsInterceptor,
    PendingRequestsInterceptorProvider
} from '../../lib/services/pending-requests-interceptor.service';

describe('PendingRequestsInterceptor', () => {
    let http: HttpClient;
    let httpMock: HttpTestingController;
    let pendingRequestsInterceptor: PendingRequestsInterceptor;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [PendingRequestsInterceptorProvider]
        });

        pendingRequestsInterceptor = TestBed.inject(PendingRequestsInterceptor);
        http = TestBed.inject(HttpClient);
        httpMock = TestBed.inject(HttpTestingController);
    });

    it('should be created', () => {
        expect(pendingRequestsInterceptor).toBeTruthy();
    });

    it('should be aware of the pending HTTP requests', () => {
        const runQuery$ = (url: string): Observable<any> => http.get(url);

        forkJoin([runQuery$('/fake'), runQuery$('/fake2')]).subscribe();

        const firstRequest = httpMock.expectOne('/fake');
        const secondRequest = httpMock.expectOne('/fake2');

        expect(pendingRequestsInterceptor.pendingRequests).toBe(2);
        firstRequest.flush({});

        expect(pendingRequestsInterceptor.pendingRequests).toBe(1);
        secondRequest.flush({});

        expect(pendingRequestsInterceptor.pendingRequests).toBe(0);

        httpMock.verify();
    });

    it('should not include pending requests for URLs that are not in the include filter when there is an include filter applied', () => {
      const runQuery$ = (url: string): Observable<any> => http.get(url);
      pendingRequestsInterceptor.includedUrlPatterns.push(new RegExp('^/?included-url\w*'));

      forkJoin([runQuery$('/included-url'), runQuery$('/non-included-url')]).subscribe();

      const firstRequest = httpMock.expectOne('/non-included-url');
      const secondRequest = httpMock.expectOne('/included-url');

      expect(pendingRequestsInterceptor.pendingRequests).toBe(1);
      firstRequest.flush({});

      expect(pendingRequestsInterceptor.pendingRequests).toBe(1);
      secondRequest.flush({});

      expect(pendingRequestsInterceptor.pendingRequests).toBe(0);

      httpMock.verify();
    });

    it('should not include pending requests for URLs that are in the filtered URLs', () => {
      const runQuery$ = (url: string): Observable<any> => http.get(url);
      pendingRequestsInterceptor.filteredUrlPatterns.push(new RegExp('^/?excluded-url\w*'));

      forkJoin([runQuery$('/excluded-url'), runQuery$('/included-url')]).subscribe();

      const firstRequest = httpMock.expectOne('/excluded-url');
      const secondRequest = httpMock.expectOne('/included-url');

      expect(pendingRequestsInterceptor.pendingRequests).toBe(1);
      firstRequest.flush({});

      expect(pendingRequestsInterceptor.pendingRequests).toBe(1);
      secondRequest.flush({});

      expect(pendingRequestsInterceptor.pendingRequests).toBe(0);

      httpMock.verify();
    });

    it('should correctly notify the pendingRequestsStatus observable', waitForAsync(() => {
        pendingRequestsInterceptor
            .pendingRequestsStatus$
            .subscribe({
                next: (next: boolean) => expect(next).toBeTruthy(),
                error: () => expect(1).toBe(2)
            });

        http.get('/fake').subscribe();
        httpMock.expectOne('/fake');
    }));

    it('should correctly notify the pendingRequestsStatus observable, even if subscribed after', waitForAsync(() => {
        http.get('/fake').subscribe();
        httpMock.expectOne('/fake');

        pendingRequestsInterceptor
            .pendingRequestsStatus$
            .subscribe({
                next: (next: boolean) => expect(next).toBeTruthy(),
                error: () => expect(1).toBe(2)
            });
    }));

    it('should fail correctly', () => {
        const statusTextNotFound = 'NOT FOUND';

        http.get('/fake').subscribe({
            next: () => expect(true).toBe(false),
            error: (error: any) => expect(error.statusText).toBe(statusTextNotFound)
        });

        const testRequest = httpMock.expectOne('/fake');
        testRequest.flush({}, {
            status: 404,
            statusText: statusTextNotFound
        });
        httpMock.verify();
    });
});

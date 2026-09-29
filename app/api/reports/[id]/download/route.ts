import { apiError, HttpError, requireApiMember } from '@/lib/auth';
import { getReport, signedDownloadUrl } from '@/lib/reports';

// Redirects to a 60-second signed link, so files are never publicly reachable.
export async function GET(request: Request, ctx: RouteContext<'/api/reports/[id]/download'>) {
  try {
    await requireApiMember(request);
    const format = new URL(request.url).searchParams.get('format');
    if (format !== 'pdf' && format !== 'xlsx') throw new HttpError(400, 'Unknown file type.');
    const report = await getReport((await ctx.params).id);
    if (!report || report.status !== 'completed') throw new HttpError(404, 'This report has no files yet.');
    const url = await signedDownloadUrl(report, format);
    if (!url) throw new HttpError(404, 'File not found.');
    return Response.redirect(url, 302);
  } catch (error) {
    return apiError(error);
  }
}

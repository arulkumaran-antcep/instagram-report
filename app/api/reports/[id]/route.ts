import { apiError, HttpError, requireApiMember } from '@/lib/auth';
import { deleteReport, getReport } from '@/lib/reports';

// Lightweight status for the progress screen.
export async function GET(request: Request, ctx: RouteContext<'/api/reports/[id]'>) {
  try {
    await requireApiMember(request);
    const report = await getReport((await ctx.params).id);
    if (!report) throw new HttpError(404, 'Report not found.');
    return Response.json(
      {
        id: report.id,
        handle: report.handle,
        status: report.status,
        stage: report.stage,
        progress: report.progress,
        error: report.error_message,
        updatedAt: report.updated_at,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/reports/[id]'>) {
  try {
    const member = await requireApiMember(request);
    const report = await getReport((await ctx.params).id);
    if (!report) throw new HttpError(404, 'Report not found.');
    if (member.role !== 'admin' && report.created_by !== member.userId) {
      throw new HttpError(403, 'Only the person who generated this report, or an admin, can delete it.');
    }
    if (report.status === 'queued' || report.status === 'processing') {
      throw new HttpError(409, 'This report is still being generated. Delete it once it finishes.');
    }
    await deleteReport(report);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

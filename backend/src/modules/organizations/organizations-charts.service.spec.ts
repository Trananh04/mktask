import { OrganizationChartsService } from './organizations-charts.service';
import { ChartScope, ChartType } from './dto/get-charts-query.dto';

describe('OrganizationChartsService personal chart scope', () => {
  const organizationId = '11111111-1111-4111-8111-111111111111';
  const managerId = '22222222-2222-4222-8222-222222222222';

  const createService = () => {
    const prisma: any = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const accessControl: any = {
      getOrgAccess: jest.fn().mockResolvedValue({ isElevated: true }),
    };

    return {
      service: new OrganizationChartsService(prisma, accessControl),
      prisma,
    };
  };

  it('limits member workload to the current user for elevated users requesting personal charts', async () => {
    const { service, prisma } = createService();

    await service.getMultipleChartData(organizationId, managerId, [ChartType.MEMBER_WORKLOAD], {
      scope: ChartScope.PERSONAL,
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: managerId }),
        orderBy: undefined,
      }),
    );
  });
});

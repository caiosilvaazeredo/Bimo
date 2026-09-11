import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async findActiveBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { slug, active: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant "${slug}" não encontrado ou inativo`);
    }
    return tenant;
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }
    return tenant;
  }

  async create(input: { name: string; slug: string }): Promise<Tenant> {
    return this.tenantRepository.save(
      this.tenantRepository.create({
        name: input.name,
        slug: input.slug,
        active: true,
      }),
    );
  }

  async listAll(): Promise<Tenant[]> {
    return this.tenantRepository.find();
  }

  async setContingencyEnabled(id: string, enabled: boolean): Promise<void> {
    await this.tenantRepository.update({ id }, { contingencyEnabled: enabled });
  }
}

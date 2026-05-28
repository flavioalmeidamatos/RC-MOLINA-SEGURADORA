import { Request, Response } from 'express';
import { getPool } from './clientes'; // reuse getPool

export const listAgendamentosHandler = async (req: Request, res: Response) => {
  const pool = getPool();
  try {
    const result = await pool.query(`
      SELECT a.*, 
             TO_CHAR(a.data_agendamento, 'YYYY-MM-DD') as data_agendamento,
             c.nome_completo as cliente_nome,
             (
               SELECT cc.valor
               FROM "RCMOLINASEGUROS"."CLIENTES_CONTATOS" cc
               WHERE cc.id_cliente = c.id_cliente
                 AND lower(cc.tipo) LIKE '%celular%'
               ORDER BY cc.preferencial DESC, cc.criado_em ASC
               LIMIT 1
             ) as telefone_celular,
             (
               SELECT cc.valor
               FROM "RCMOLINASEGUROS"."CLIENTES_CONTATOS" cc
               WHERE cc.id_cliente = c.id_cliente
                 AND lower(cc.tipo) LIKE '%telefone%'
               ORDER BY cc.preferencial DESC, cc.criado_em ASC
               LIMIT 1
             ) as telefone_residencial
      FROM "RCMOLINASEGUROS"."AGENDAMENTOS" a
      JOIN "RCMOLINASEGUROS"."CLIENTES" c ON a.id_cliente = c.id_cliente
      ORDER BY a.data_agendamento ASC, a.hora_inicio ASC
    `);
    res.json({ data: result.rows });
  } catch (error: any) {
    console.error('Error fetching agendamentos:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createAgendamentoHandler = async (req: Request, res: Response) => {
  const pool = getPool();
  const { id_cliente, data_agendamento, hora_inicio, hora_fim, duracao_minutos, observacao, repetir, enviar_sms } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO "RCMOLINASEGUROS"."AGENDAMENTOS" (
        id_cliente, data_agendamento, hora_inicio, hora_fim, duracao_minutos, observacao, repetir, enviar_sms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id_cliente, data_agendamento, hora_inicio, hora_fim, duracao_minutos, observacao, repetir, enviar_sms || false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating agendamento:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateAgendamentoHandler = async (req: Request, res: Response) => {
  const pool = getPool();
  const { id } = req.params;
  const { id_cliente, data_agendamento, hora_inicio, hora_fim, duracao_minutos, observacao, repetir, enviar_sms } = req.body;

  try {
    const result = await pool.query(
      `UPDATE "RCMOLINASEGUROS"."AGENDAMENTOS" SET
        id_cliente = coalesce($1, id_cliente),
        data_agendamento = coalesce($2, data_agendamento),
        hora_inicio = coalesce($3, hora_inicio),
        hora_fim = coalesce($4, hora_fim),
        duracao_minutos = coalesce($5, duracao_minutos),
        observacao = coalesce($6, observacao),
        repetir = coalesce($7, repetir),
        enviar_sms = coalesce($8, enviar_sms)
      WHERE id_agendamento = $9 RETURNING *`,
      [id_cliente, data_agendamento, hora_inicio, hora_fim, duracao_minutos, observacao, repetir, enviar_sms, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Agendamento not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating agendamento:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteAgendamentoHandler = async (req: Request, res: Response) => {
  const pool = getPool();
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM "RCMOLINASEGUROS"."AGENDAMENTOS" WHERE id_agendamento = $1 RETURNING id_agendamento`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Agendamento not found' });
    }

    res.json({ message: 'Agendamento deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting agendamento:', error);
    res.status(500).json({ error: error.message });
  }
};

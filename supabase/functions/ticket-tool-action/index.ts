// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const TICKET_TOOL_API = 'https://api.tickettool.xyz/v1';
const GUILD_ID = '1463228311118549124';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'content-type',
      },
    });
  }

  try {
    const body = await req.json();
    const { action, userId, subject, description, ticketId } = body;

    const apiKey = Deno.env.get('TICKET_TOOL_API_KEY');
    const panelId = Deno.env.get('TICKET_TOOL_PANEL_ID');

    if (!apiKey || !panelId) {
      return new Response(
        JSON.stringify({ error: 'Ticket Tool credentials not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    if (action === 'open') {
      // Открыть тикет
      const response = await fetch(`${TICKET_TOOL_API}/tickets/open`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          guild_id: GUILD_ID,
          panel_id: panelId,
          user_id: userId,
          reason: `${subject}\n\n${description}`,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('Ticket Tool error:', err);
        return new Response(
          JSON.stringify({ error: 'Failed to open ticket', detail: err, status: response.status }),
          { status: response.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({ success: true, ticket: data }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );

    } else if (action === 'close') {
      // Закрыть тикет
      const response = await fetch(`${TICKET_TOOL_API}/tickets/close`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          guild_id: GUILD_ID,
          ticket_id: ticketId,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return new Response(
          JSON.stringify({ error: 'Failed to close ticket', detail: err }),
          { status: response.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Unknown action' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
});

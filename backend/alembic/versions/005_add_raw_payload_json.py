"""add raw_payload_json to webhook_batch_items"""

import sqlalchemy as sa

revision = '005_add_raw_payload_json'
down_revision = '004_add_trigger_type'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'webhook_batch_items',
        sa.Column('raw_payload_json', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('webhook_batch_items', 'raw_payload_json')

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import type { AuthUser } from "@/common/auth/auth.types";
import { CurrentUser } from "@/common/auth/current-user.decorator";
import { UnauthorizedError } from "@/common/errors/app.error";
import type { Paginated } from "@/common/utils/pagination.util";

import { CreateNoteDto } from "@/modules/notes/dto/create-note.dto";
import { ListNotesQueryDto } from "@/modules/notes/dto/list-notes-query.dto";
import { NoteResponseDto } from "@/modules/notes/dto/note-response.dto";
import { UpdateNoteDto } from "@/modules/notes/dto/update-note.dto";
import { NotesService } from "@/modules/notes/notes.service";
import type { NoteDetail, NoteListItem } from "@/modules/notes/notes.types";

/**
 * Reference CRUD controller for notes. The caller's id comes from
 * `@CurrentUser()`, resolved by the global `JwtAuthGuard` — no handler here
 * reads the raw request for identity. Body/query validation runs through
 * the global `ZodValidationPipe` (installed once in `app.module.ts` via
 * `APP_PIPE`) — this controller does not re-install it.
 */
@ApiTags("notes")
@Controller({ path: "notes", version: "1" })
export class NotesController {
  /**
   * Creates the controller.
   *
   * @param notesService - The notes service.
   */
  constructor(private readonly notesService: NotesService) {}

  /**
   * Reads the owner id off the resolved identity.
   *
   * @param user - The current request's resolved identity, if any.
   * @returns The caller's owner id.
   * @throws {UnauthorizedError} When no identity was resolved. Should not
   * happen behind the global `JwtAuthGuard`, but keeps this boundary honest
   * without a non-null assertion.
   */
  private ownerIdOf(user: AuthUser | undefined): string {
    if (user === undefined) {
      throw new UnauthorizedError("No authenticated user on the request");
    }

    return user.userId;
  }

  /**
   * Creates a note owned by the caller.
   *
   * @param user - The current request's resolved identity.
   * @param dto - The note to create.
   * @returns The created note.
   */
  @Post()
  @ApiOperation({ summary: "Create a note" })
  @ApiResponse({
    status: 201,
    description: "The created note.",
    type: NoteResponseDto,
  })
  public async create(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: CreateNoteDto,
  ): Promise<NoteDetail> {
    return this.notesService.create(this.ownerIdOf(user), dto);
  }

  /**
   * Lists notes owned by the caller, with pagination and an optional status
   * filter.
   *
   * @param user - The current request's resolved identity.
   * @param query - The pagination and filter params.
   * @returns The matching page of notes.
   */
  @Get()
  @ApiOperation({ summary: "List notes" })
  @ApiResponse({ status: 200, description: "A page of notes." })
  public async list(
    @CurrentUser() user: AuthUser | undefined,
    @Query() query: ListNotesQueryDto,
  ): Promise<Paginated<NoteListItem>> {
    return this.notesService.list(this.ownerIdOf(user), query);
  }

  /**
   * Fetches a single note by id, scoped to the caller.
   *
   * @param user - The current request's resolved identity.
   * @param id - The note's id.
   * @returns The note.
   */
  @Get(":id")
  @ApiOperation({ summary: "Get a note by id" })
  @ApiResponse({ status: 200, description: "The note.", type: NoteResponseDto })
  @ApiResponse({ status: 404, description: "No note with that id exists." })
  public async findById(
    @CurrentUser() user: AuthUser | undefined,
    @Param("id") id: string,
  ): Promise<NoteDetail> {
    return this.notesService.findById(this.ownerIdOf(user), id);
  }

  /**
   * Updates a note, scoped to the caller.
   *
   * @param user - The current request's resolved identity.
   * @param id - The note's id.
   * @param dto - The fields to update.
   * @returns The updated note.
   */
  @Patch(":id")
  @ApiOperation({ summary: "Update a note" })
  @ApiResponse({
    status: 200,
    description: "The updated note.",
    type: NoteResponseDto,
  })
  @ApiResponse({ status: 404, description: "No note with that id exists." })
  public async update(
    @CurrentUser() user: AuthUser | undefined,
    @Param("id") id: string,
    @Body() dto: UpdateNoteDto,
  ): Promise<NoteDetail> {
    return this.notesService.update(this.ownerIdOf(user), id, dto);
  }

  /**
   * Deletes a note, scoped to the caller.
   *
   * @param user - The current request's resolved identity.
   * @param id - The note's id.
   * @returns A promise that resolves once the note is removed.
   */
  @Delete(":id")
  @ApiOperation({ summary: "Delete a note" })
  @ApiResponse({ status: 200, description: "The note was deleted." })
  @ApiResponse({ status: 404, description: "No note with that id exists." })
  public async remove(
    @CurrentUser() user: AuthUser | undefined,
    @Param("id") id: string,
  ): Promise<void> {
    return this.notesService.remove(this.ownerIdOf(user), id);
  }
}
